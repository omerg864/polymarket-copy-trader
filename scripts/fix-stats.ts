/**
 * Fix corrupted BotStats: recalculate totalFees and totalPnl
 * from the actual trade data in Redis.
 */
import dotenv from 'dotenv';
import Redis from 'ioredis';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', 'btc5-bot', '.env') });

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const PREFIX = 'pmbot:';
const MODE = process.env.MODE || 'demo';

async function main() {
	const redis = new Redis(REDIS_URL);
	console.log(`Connected to Redis`);

	let totalFees = 0;
	let totalPnl = 0;

	// Sum fees from active trades
	const activeIds = await redis.smembers(`${PREFIX}active_trades`);
	console.log(`Active trades: ${activeIds.length}`);
	for (const id of activeIds) {
		const raw = await redis.get(`${PREFIX}trade:${id}`);
		if (!raw) continue;
		const trade = JSON.parse(raw);
		totalFees += trade.fee ?? 0;
		console.log(`  Active ${id}: fee=${trade.fee ?? 0}`);
	}

	// Sum fees + pnl from history
	const historyKey = `${PREFIX}history`;
	const historyLen = await redis.llen(historyKey);
	console.log(`History trades: ${historyLen}`);
	for (let i = 0; i < historyLen; i++) {
		const raw = await redis.lindex(historyKey, i);
		if (!raw) continue;
		const trade = JSON.parse(raw);
		totalFees += trade.fee ?? 0;
		totalPnl += trade.pnl ?? 0;
	}

	// Update stats
	const statsKey = `${PREFIX}${MODE}:stats`;
	const statsRaw = await redis.get(statsKey);
	if (!statsRaw) {
		console.error('No stats found at', statsKey);
		await redis.quit();
		return;
	}

	const stats = JSON.parse(statsRaw);
	console.log(
		`\nBefore: totalFees=${stats.totalFees}, totalPnl=${stats.totalPnl}`,
	);

	stats.totalFees = Math.round(totalFees * 10000) / 10000;
	stats.totalPnl = Math.round(totalPnl * 10000) / 10000;

	await redis.set(statsKey, JSON.stringify(stats));
	console.log(
		`After:  totalFees=${stats.totalFees}, totalPnl=${stats.totalPnl}`,
	);
	console.log(`\n✅ Stats fixed.`);

	await redis.quit();
}

main().catch((err) => {
	console.error('Error:', err);
	process.exit(1);
});
