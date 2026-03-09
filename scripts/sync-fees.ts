/**
 * One-time script to backfill fee field on existing trades in Redis.
 * Calculates the buy fee for each active trade and trade history entry
 * that doesn't already have a fee, and updates BotStats.totalFees.
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
const FEE_RATE = 0.0175;

function calculateFee(shares: number, price: number): number {
	const raw = shares * price * FEE_RATE * (price * (1 - price));
	return Math.round(raw * 10000) / 10000;
}

async function main() {
	const redis = new Redis(REDIS_URL);
	console.log(`Connected to Redis (${REDIS_URL})`);

	let totalFeesAdded = 0;
	let tradesUpdated = 0;

	// 1. Update active trades
	const activeIds = await redis.smembers(`${PREFIX}active_trades`);
	console.log(`Found ${activeIds.length} active trade(s)`);

	for (const id of activeIds) {
		const raw = await redis.get(`${PREFIX}trade:${id}`);
		if (!raw) continue;

		const trade = JSON.parse(raw);
		if (trade.fee && trade.fee > 0) {
			console.log(`  ✓ ${id} already has fee $${trade.fee}`);
			totalFeesAdded += trade.fee;
			continue;
		}

		const fee = calculateFee(trade.size, trade.entryPrice);
		trade.fee = fee;
		await redis.set(`${PREFIX}trade:${id}`, JSON.stringify(trade));
		totalFeesAdded += fee;
		tradesUpdated++;
		console.log(
			`  ✏️  ${id} — size=${trade.size} price=${trade.entryPrice} → fee=$${fee.toFixed(4)}`,
		);
	}

	// 2. Update trade history
	const historyKey = `${PREFIX}history`;
	const historyLen = await redis.llen(historyKey);
	console.log(`\nFound ${historyLen} history trade(s)`);

	for (let i = 0; i < historyLen; i++) {
		const raw = await redis.lindex(historyKey, i);
		if (!raw) continue;

		const trade = JSON.parse(raw);
		if (trade.fee && trade.fee > 0) {
			totalFeesAdded += trade.fee;
			continue;
		}

		const buyFee = calculateFee(trade.size, trade.entryPrice);
		let sellFee = 0;
		if (
			trade.exitPrice !== undefined &&
			trade.exitPrice > 0 &&
			trade.exitPrice < 1 &&
			(trade.status === 'closed_tp' ||
				trade.status === 'closed_sl' ||
				trade.status === 'closed_sell')
		) {
			sellFee = calculateFee(trade.size, trade.exitPrice);
		}

		const totalFee = buyFee + sellFee;
		trade.fee = totalFee;

		// Recalculate PnL with fee
		if (trade.exitPrice !== undefined) {
			const revenue = trade.exitPrice * trade.size;
			trade.pnl = revenue - trade.cost - totalFee;
		}

		await redis.lset(historyKey, i, JSON.stringify(trade));
		totalFeesAdded += totalFee;
		tradesUpdated++;
		console.log(
			`  ✏️  ${trade.id} — buyFee=$${buyFee.toFixed(4)} sellFee=$${sellFee.toFixed(4)} total=$${totalFee.toFixed(4)}`,
		);
	}

	// 3. Update BotStats.totalFees
	const statsKey = `${PREFIX}${MODE}:stats`;
	const statsRaw = await redis.get(statsKey);
	if (statsRaw) {
		const stats = JSON.parse(statsRaw);
		const oldFees = stats.totalFees || 0;
		stats.totalFees = totalFeesAdded;

		// Recalculate totalPnl from history
		let totalPnl = 0;
		for (let i = 0; i < historyLen; i++) {
			const raw = await redis.lindex(historyKey, i);
			if (!raw) continue;
			const t = JSON.parse(raw);
			totalPnl += t.pnl ?? 0;
		}
		stats.totalPnl = totalPnl;

		await redis.set(statsKey, JSON.stringify(stats));
		console.log(
			`\n📊 Updated stats: totalFees $${oldFees} → $${totalFeesAdded.toFixed(4)}, totalPnl → $${totalPnl.toFixed(4)}`,
		);
	}

	console.log(`\n✅ Done. Updated ${tradesUpdated} trade(s).`);
	console.log(
		`   Total fees across all trades: $${totalFeesAdded.toFixed(4)}`,
	);

	await redis.quit();
}

main().catch((err) => {
	console.error('Error:', err);
	process.exit(1);
});
