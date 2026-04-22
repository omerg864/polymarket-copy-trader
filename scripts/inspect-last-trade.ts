/**
 * Inspect and fix the last trade in history that has pnl=0 but was won.
 */
import dotenv from 'dotenv';
import Redis from 'ioredis';
import path from 'path';
import { fileURLToPath } from 'url';
import { TradeType } from '../shared/src/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', 'btc5-bot', '.env') });

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const PREFIX = 'pmbot:';
const MODE = process.env.MODE === 'live' ? TradeType.LIVE : TradeType.DEMO;
const FEE_RATE = 0.0175;

function calculateFee(shares: number, price: number): number {
	const raw = shares * price * FEE_RATE * (price * (1 - price));
	return Math.round(raw * 10000) / 10000;
}

async function main() {
	const redis = new Redis(REDIS_URL);

	const historyKey = `${PREFIX}${MODE}:history`;
	const historyLen = await redis.llen(historyKey);

	// Find and fix all trades with pnl=0 or null
	console.log(
		`History has ${historyLen} trades. Finding & fixing pnl=0/null trades:\n`,
	);
	let fixCount = 0;
	for (let i = 0; i < historyLen; i++) {
		const raw = await redis.lindex(historyKey, i);
		if (!raw) continue;
		const t = JSON.parse(raw);
		if (t.pnl === 0 || t.pnl === null || t.pnl === undefined) {
			console.log(
				`[${i}] id=${t.id} status=${t.status} size=${t.size} entry=${t.entryPrice} exit=${t.exitPrice} pnl=${t.pnl} fee=${t.fee}`,
			);

			// Calculate fee
			const buyFee = calculateFee(t.size, t.entryPrice);
			let sellFee = 0;
			if (
				t.exitPrice != null &&
				t.exitPrice > 0 &&
				t.exitPrice < 1 &&
				(t.status === 'closed_tp' ||
					t.status === 'closed_sl' ||
					t.status === 'closed_sell')
			) {
				sellFee = calculateFee(t.size, t.exitPrice);
			}
			const fee = buyFee + sellFee;
			t.fee = fee;

			// Calculate PnL: won = exitPrice(1) * size - cost - fee
			if (t.exitPrice != null) {
				const revenue = t.exitPrice * t.size;
				t.pnl = revenue - t.cost - fee;
			}

			await redis.lset(historyKey, i, JSON.stringify(t));
			console.log(
				`  → Fixed: fee=${t.fee.toFixed(4)}, pnl=${t.pnl?.toFixed(4)}`,
			);
			fixCount++;
		}
	}
	console.log(`\nFixed ${fixCount} trade(s).`);

	// Now recalculate stats
	if (fixCount > 0) {
		let totalFees = 0;
		let totalPnl = 0;

		// Active trades fees
		const activeIds = await redis.smembers(`${PREFIX}${MODE}:active_trades`);
		for (const id of activeIds) {
			const raw = await redis.get(`${PREFIX}${MODE}:trade:${id}`);
			if (!raw) continue;
			const t = JSON.parse(raw);
			totalFees += t.fee ?? 0;
		}

		// History fees + pnl
		for (let i = 0; i < historyLen; i++) {
			const raw = await redis.lindex(historyKey, i);
			if (!raw) continue;
			const t = JSON.parse(raw);
			totalFees += t.fee ?? 0;
			totalPnl += t.pnl ?? 0;
		}

		const statsKey = `${PREFIX}${MODE}:stats`;
		const statsRaw = await redis.get(statsKey);
		if (statsRaw) {
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
		}
	}

	await redis.quit();
}

main().catch((err) => {
	console.error('Error:', err);
	process.exit(1);
});
