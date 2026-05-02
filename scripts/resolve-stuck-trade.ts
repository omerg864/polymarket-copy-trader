/**
 * Surgical Resolve Script
 * Manually moves a trade from active to history with calculated PnL.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', 'copy-bot', '.env') });

import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const tradeId = '7558c915-45cf-427b-980b-3a0973bfec64';

async function main() {
	const redis = new Redis(REDIS_URL);
	console.log('Connected to Redis');

	const rawTrade = await redis.get(`pmbot:trade:${tradeId}`);
	if (!rawTrade) {
		console.error(`Trade ${tradeId} not found in Redis!`);
		process.exit(1);
	}

	const trade = JSON.parse(rawTrade);
	console.log(`Manually resolving trade: ${trade.title}`);

	// Calculation based on market outcome (UP won)
	const revenue = 1.0 * trade.size;
	const totalFee = trade.fee; // already paid at entry
	trade.exitPrice = 1.0;
	trade.pnl = revenue - trade.cost - totalFee;
	trade.status = 'won';
	trade.closedAt = new Date().toISOString();
	trade.pctChange = (trade.exitPrice - trade.entryPrice) / trade.entryPrice;

	// 1. Remove from active
	await redis.srem('pmbot:active_trades', tradeId);
	await redis.del(`pmbot:trade:${tradeId}`);

	// 2. Add to history (at the beginning)
	await redis.lpush('pmbot:history', JSON.stringify(trade));
	await redis.sadd('pmbot:history_ids', tradeId);

	// 3. Update stats
	const rawStats = await redis.get('pmbot:demo:stats');
	if (rawStats) {
		const stats = JSON.parse(rawStats);
		stats.totalTrades += 1;
		stats.wins += 1;
		stats.totalPnl += trade.pnl;
		stats.totalFees += totalFee;
		stats.lastUpdated = new Date().toISOString();
		await redis.set('pmbot:demo:stats', JSON.stringify(stats));
		console.log('Updated Stats:', stats);
	}

	// 4. Update Balance
	const rawBal = await redis.get('pmbot:demo:balance');
	if (rawBal) {
		const bal = parseFloat(rawBal);
		const newBal = bal + revenue; // Bot already subtracted cost+fee at entry
		await redis.set('pmbot:demo:balance', newBal.toString());
		console.log(`Updated Balance: ${newBal}`);
	}

	console.log('✅ Surgical resolution complete.');
	await redis.quit();
}

main().catch((err) => {
	console.error('Error:', err);
	process.exit(1);
});
