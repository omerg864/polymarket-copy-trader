/**
 * Inspect specific trade details.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Redis from 'ioredis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
	path: path.resolve(__dirname, '..', 'copy-bot', '.env.production.local'),
});

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const PREFIX = 'pmbot:';
const MODE = process.env.MODE || 'production';

const TARGET_TRADE_IDS = [
	'fcbaa68c-c826-4d25-b691-2b26042861e9',
	'1c1dc021-2f8f-4480-9844-5cdaabc82af6',
];

async function main() {
	const redis = new Redis(REDIS_URL);
	const historyKey = `${PREFIX}${MODE}:history`;
	const historyRaw = await redis.lrange(historyKey, 0, -1);

	for (const id of TARGET_TRADE_IDS) {
		const raw = historyRaw.find((r) => JSON.parse(r).id === id);
		if (raw) {
			console.log(`Trade ${id}:`);
			const t = JSON.parse(raw);
			console.log(JSON.stringify(t, null, 2));
		}
	}
	await redis.quit();
}

main().catch(console.error);
