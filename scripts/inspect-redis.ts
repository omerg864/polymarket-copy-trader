/**
 * Inspect all Redis keys and their values.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', 'btc5-bot', '.env') });

import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function main() {
	const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 3 });

	const keys = await redis.keys('pmbot:*');
	console.log(`Total keys: ${keys.length}\n`);

	for (const key of keys.sort()) {
		const type = await redis.type(key);
		if (type === 'string') {
			const val = await redis.get(key);
			console.log(`${key} (${type}): ${val}`);
		} else if (type === 'list') {
			const len = await redis.llen(key);
			const first = await redis.lindex(key, 0);
			const last = await redis.lindex(key, len - 1);
			console.log(`${key} (${type}): ${len} items`);
			console.log(`  first: ${first?.substring(0, 150)}`);
			console.log(`  last:  ${last?.substring(0, 150)}`);
		} else if (type === 'set') {
			const members = await redis.smembers(key);
			console.log(`${key} (${type}): ${JSON.stringify(members)}`);
		} else {
			console.log(`${key} (${type})`);
		}
		console.log();
	}

	await redis.quit();
}

main().catch((err) => {
	console.error('Error:', err);
	process.exit(1);
});
