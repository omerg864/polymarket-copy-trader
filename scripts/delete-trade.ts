/**
 * Delete a specific trade from history.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Redis from 'ioredis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
	path: path.resolve(__dirname, '..', 'btc5-bot', '.env.production.local'),
});

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const PREFIX = 'pmbot:';
const MODE = process.env.MODE || 'production';

const TARGET_TRADE_ID = '3b8165f2-329e-48cb-ae31-cb592c061bf0';

async function main() {
	const redis = new Redis(REDIS_URL);
	console.log(`Connected to Redis (MODE: ${MODE})\n`);

	const historyKey = `${PREFIX}${MODE}:history`;
	const historyRaw = await redis.lrange(historyKey, 0, -1);

	const tradeIndex = historyRaw.findIndex(
		(r) => JSON.parse(r).id === TARGET_TRADE_ID,
	);

	if (tradeIndex !== -1) {
		const trade = JSON.parse(historyRaw[tradeIndex]);
		console.log(
			`Deleting trade ${TARGET_TRADE_ID}: ${trade.direction} on ${trade.slug}`,
		);

		// Remove by value to be safe (LREM)
		await redis.lrem(historyKey, 1, historyRaw[tradeIndex]);
		console.log(`  🚀 Trade deleted from ${historyKey}`);
	} else {
		console.warn(`  ⚠️  Trade ${TARGET_TRADE_ID} not found in history.`);
	}

	await redis.quit();
}

main().catch(console.error);
