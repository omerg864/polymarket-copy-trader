/**
 * Restore data from an RDB backup file into the remote Redis.
 * Parses the RDB v12 binary format directly and writes all keys.
 */
import dotenv from 'dotenv';
import fs from 'fs';
import Redis from 'ioredis';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', 'copy-bot', '.env') });

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const RDB_FILE = path.resolve(
	__dirname,
	'499d3860-5a23-4b56-b8a1-8e62873ab4a6.rdb',
);

// ---- RDB v12 parser (minimal, handles STRING + LIST types) ----

class RDBParser {
	private buf: Buffer;
	private pos: number;

	constructor(buf: Buffer) {
		this.buf = buf;
		this.pos = 0;
	}

	private readByte(): number {
		return this.buf[this.pos++];
	}

	private readBytes(n: number): Buffer {
		const slice = this.buf.subarray(this.pos, this.pos + n);
		this.pos += n;
		return slice;
	}

	private readLength(): { len: number; isEncoded: boolean } {
		const first = this.readByte();
		const type = (first & 0xc0) >> 6;

		if (type === 0) {
			// 6-bit length
			return { len: first & 0x3f, isEncoded: false };
		} else if (type === 1) {
			// 14-bit length
			const second = this.readByte();
			return { len: ((first & 0x3f) << 8) | second, isEncoded: false };
		} else if (type === 2) {
			// Large length: 0x80 = 32-bit, 0x81 = 64-bit
			if (first === 0x80) {
				const val = this.buf.readUInt32BE(this.pos);
				this.pos += 4;
				return { len: val, isEncoded: false };
			} else if (first === 0x81) {
				const hi = this.buf.readUInt32BE(this.pos);
				const lo = this.buf.readUInt32BE(this.pos + 4);
				this.pos += 8;
				return { len: hi * 0x100000000 + lo, isEncoded: false };
			}
			throw new Error(
				`Unknown type-2 length prefix: 0x${first.toString(16)}`,
			);
		} else {
			// type === 3: special encoding (integers, LZF)
			return { len: first & 0x3f, isEncoded: true };
		}
	}

	private readString(): string {
		const { len, isEncoded } = this.readLength();

		if (isEncoded) {
			if (len === 0) {
				// 8-bit integer
				const val = this.buf.readInt8(this.pos);
				this.pos += 1;
				return val.toString();
			} else if (len === 1) {
				// 16-bit integer
				const val = this.buf.readInt16LE(this.pos);
				this.pos += 2;
				return val.toString();
			} else if (len === 2) {
				// 32-bit integer
				const val = this.buf.readInt32LE(this.pos);
				this.pos += 4;
				return val.toString();
			} else if (len === 3) {
				// LZF compressed
				const { len: clen } = this.readLength();
				const { len: ulen } = this.readLength();
				const compressed = this.readBytes(clen);
				return this.decompressLZF(compressed, ulen).toString('utf8');
			}
			throw new Error(`Unknown special string encoding: ${len}`);
		}

		const bytes = this.readBytes(len);
		return bytes.toString('utf8');
	}

	private decompressLZF(input: Buffer, outLen: number): Buffer {
		const output = Buffer.alloc(outLen);
		let ip = 0;
		let op = 0;

		while (ip < input.length) {
			let ctrl = input[ip++];

			if (ctrl < 32) {
				// Literal run: ctrl + 1 bytes
				ctrl++;
				for (let i = 0; i < ctrl; i++) {
					output[op++] = input[ip++];
				}
			} else {
				// Back reference
				let len = ctrl >> 5;
				let ref = op - ((ctrl & 0x1f) << 8) - 1;

				if (len === 7) {
					len += input[ip++];
				}
				ref -= input[ip++];
				len += 2;

				for (let i = 0; i < len; i++) {
					output[op] = output[ref];
					op++;
					ref++;
				}
			}
		}
		return output;
	}

	parse(): { strings: Map<string, string>; lists: Map<string, string[]> } {
		const strings = new Map<string, string>();
		const lists = new Map<string, string[]>();

		// Skip magic "REDIS" + version "0012"
		this.pos = 9;

		while (this.pos < this.buf.length) {
			const opcode = this.readByte();

			if (opcode === 0xff) {
				// EOF
				break;
			} else if (opcode === 0xfa) {
				// AUX field: key-value pair
				const key = this.readString();
				const val = this.readString();
				console.log(`  AUX: ${key} = ${val}`);
			} else if (opcode === 0xfe) {
				// SELECTDB
				const { len: db } = this.readLength();
				console.log(`  DB: ${db}`);
			} else if (opcode === 0xfb) {
				// RESIZEDB
				const { len: dbSize } = this.readLength();
				const { len: expiresSize } = this.readLength();
				console.log(
					`  RESIZEDB: ${dbSize} keys, ${expiresSize} expires`,
				);
			} else if (opcode === 0xfd) {
				// EXPIRETIME (seconds) - skip 4 bytes
				this.pos += 4;
			} else if (opcode === 0xfc) {
				// EXPIRETIME_MS - skip 8 bytes
				this.pos += 8;
			} else if (opcode === 0x00) {
				// STRING type
				const key = this.readString();
				const val = this.readString();
				strings.set(key, val);
				console.log(
					`  STRING: ${key} = ${val.length > 80 ? val.substring(0, 80) + '...' : val}`,
				);
			} else if (opcode === 0x01) {
				// LIST type (linked list encoding)
				const key = this.readString();
				const { len: count } = this.readLength();
				const items: string[] = [];
				for (let i = 0; i < count; i++) {
					items.push(this.readString());
				}
				lists.set(key, items);
				console.log(`  LIST: ${key} (${count} items)`);
			} else if (opcode === 0x02) {
				// SET type
				const key = this.readString();
				const { len: count } = this.readLength();
				const items: string[] = [];
				for (let i = 0; i < count; i++) {
					items.push(this.readString());
				}
				// Store as list for simplicity
				lists.set(key, items);
				console.log(`  SET: ${key} (${count} items)`);
			} else {
				console.error(
					`Unknown opcode 0x${opcode.toString(16)} at offset ${this.pos - 1}`,
				);
				break;
			}
		}

		return { strings, lists };
	}
}

async function main() {
	console.log(`Reading RDB file: ${RDB_FILE}`);
	const buf = fs.readFileSync(RDB_FILE);
	console.log(`File size: ${buf.length} bytes\n`);

	// Verify header
	const magic = buf.subarray(0, 5).toString();
	const version = buf.subarray(5, 9).toString();
	if (magic !== 'REDIS') {
		throw new Error(`Not a valid RDB file (magic: ${magic})`);
	}
	console.log(`RDB version: ${version}\n`);

	// Parse
	const parser = new RDBParser(buf);
	const { strings, lists } = parser.parse();

	console.log(`\nParsed: ${strings.size} strings, ${lists.size} lists`);

	// Connect to Redis and restore
	console.log(
		`\nConnecting to Redis: ${REDIS_URL.replace(/\/\/.*@/, '//***@')}`,
	);
	const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 3 });

	// Check what currently exists
	const existingKeys = await redis.keys('pmbot:*');
	console.log(`Existing keys in Redis: ${existingKeys.length}`);
	if (existingKeys.length > 0) {
		console.log('  ' + existingKeys.join(', '));
	}

	// Write string keys
	for (const [key, value] of strings) {
		await redis.set(key, value);
		console.log(`  SET ${key} (${value.length} bytes)`);
	}

	// Write list keys
	for (const [key, items] of lists) {
		// Delete existing list first
		await redis.del(key);
		if (items.length > 0) {
			// RPUSH in batches of 100
			for (let i = 0; i < items.length; i += 100) {
				const batch = items.slice(i, i + 100);
				await redis.rpush(key, ...batch);
			}
		}
		console.log(`  LIST ${key} (${items.length} items)`);
	}

	// Verify
	const finalKeys = await redis.keys('pmbot:*');
	console.log(`\n✅ Restore complete. Keys in Redis: ${finalKeys.length}`);
	for (const key of finalKeys.sort()) {
		const type = await redis.type(key);
		if (type === 'string') {
			const val = await redis.get(key);
			console.log(
				`  ${key} (${type}): ${val && val.length > 60 ? val.substring(0, 60) + '...' : val}`,
			);
		} else if (type === 'list') {
			const len = await redis.llen(key);
			console.log(`  ${key} (${type}): ${len} items`);
		} else if (type === 'set') {
			const len = await redis.scard(key);
			console.log(`  ${key} (${type}): ${len} members`);
		}
	}

	await redis.quit();
}

main().catch((err) => {
	console.error('Error:', err);
	process.exit(1);
});
