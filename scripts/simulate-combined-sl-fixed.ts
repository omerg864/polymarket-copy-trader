import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Redis from 'ioredis';
import { DateTime } from 'luxon';

// Setup paths
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
	path: path.resolve(__dirname, '..', 'copy-bot', '.env.production.local'),
});

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const PREFIX = 'pmbot:';
const MODE = process.env.MODE || 'demo';
const FIXED_COST = 100;
const TARGET_SL_PRICE = 0.4;

/**
 * COMBINED SIMULATION RULES:
 * 1. Fixed Cost = $100 for ALL trades.
 * 2. SL is fixed at 0.4 market price.
 * 3. If original status was 'closed_sl':
 *    - If actualOutcome === direction: Convert to WIN (assume survival).
 *      ROI = (1 / entryPrice) - 1
 *    - Else (actualOutcome !== direction): Recalculate loss as hitting 0.4 price.
 *      ROI = (0.4 / entryPrice) - 1
 * 4. Original winners (or other statuses):
 *    - Use original ROI: originalPnl / originalCost
 * 5. Scale fees proportionally to the $100 cost.
 */

async function main() {
	const redis = new Redis(REDIS_URL);
	console.log(
		`Connected to Redis. Running Combined Simulation: FIXED_COST=$${FIXED_COST}, SL_PRICE=${TARGET_SL_PRICE}...\n`,
	);

	const scRaw = await redis.get(`${PREFIX}strategy_config`);
	const sc = scRaw ? JSON.parse(scRaw) : {};
	const timezone = sc.timezone || 'Asia/Jerusalem';

	const historyKey = `${PREFIX}${MODE}:history`;
	const historyLen = await redis.llen(historyKey);

	const dailyStats: Record<
		string,
		{
			pnl: number;
			origPnl: number;
			count: number;
			conversions: number;
		}
	> = {};

	let totalOriginalPnl = 0;
	let totalSimulatedPnl = 0;
	let totalTrades = 0;

	let convertedToWin = 0;
	let slTradesCount = 0;

	for (let i = 0; i < historyLen; i++) {
		const raw = await redis.lindex(historyKey, i);
		if (!raw) continue;
		const t = JSON.parse(raw);

		if (!t.actualOutcome || t.actualOutcome === 'UNKNOWN') continue;
		if (t.cost <= 0) continue;

		const originalStatus = t.status;
		const originalPnl = t.pnl || 0;
		const originalCost = t.cost;
		const originalFee = t.fee || 0;

		const feeScale = FIXED_COST / originalCost;
		const simFee = originalFee * feeScale;

		let simPnl = 0;
		const isOutcomeMatch = t.actualOutcome === t.direction;
		const date =
			DateTime.fromISO(t.enteredAt).setZone(timezone).toISODate() ||
			'unknown';

		if (!dailyStats[date]) {
			dailyStats[date] = { pnl: 0, origPnl: 0, count: 0, conversions: 0 };
		}

		if (originalStatus === 'closed_sl') {
			slTradesCount++;
			if (isOutcomeMatch) {
				// Convert to WIN
				const roi = 1 / t.entryPrice - 1;
				simPnl = roi * FIXED_COST - simFee;
				convertedToWin++;
				dailyStats[date].conversions++;
			} else {
				// Still LOSS, but at 0.4 price
				if (t.entryPrice > TARGET_SL_PRICE) {
					const roi = TARGET_SL_PRICE / t.entryPrice - 1;
					simPnl = roi * FIXED_COST - simFee;
				} else {
					// Entry already too low
					simPnl = -FIXED_COST - simFee;
				}
			}
		} else {
			// Winner or other - scale original ROI
			const roi = originalPnl / originalCost;
			simPnl = roi * FIXED_COST;
		}

		dailyStats[date].pnl += simPnl;
		dailyStats[date].origPnl += originalPnl;
		dailyStats[date].count++;

		totalOriginalPnl += originalPnl;
		totalSimulatedPnl += simPnl;
		totalTrades++;
	}

	console.log('--- Daily Combined Simulation ---');
	console.log(
		'Date'.padEnd(12),
		'| Trades | Conv | Orig PnL  | Sim PnL   | Diff',
	);
	console.log('-'.repeat(65));

	const sortedDates = Object.keys(dailyStats).sort();
	for (const date of sortedDates) {
		const s = dailyStats[date];
		const diff = s.pnl - s.origPnl;
		console.log(
			`${date.padEnd(12)} | ${s.count.toString().padEnd(6)} | ` +
				`${s.conversions.toString().padEnd(4)} | ` +
				`${s.origPnl.toFixed(2).padStart(10)} | ` +
				`${s.pnl.toFixed(2).padStart(10)} | ` +
				`${diff.toFixed(2).padStart(8)}`,
		);
	}

	console.log('\n' + '-'.repeat(90));
	console.log(`TOTAL TRADES SIMULATED:  ${totalTrades}`);
	console.log(`TOTAL ORIGINAL PNL:     $${totalOriginalPnl.toFixed(2)}`);
	console.log(`TOTAL SIMULATED PNL:    $${totalSimulatedPnl.toFixed(2)}`);
	console.log(
		`PNL DIFFERENCE:         $${(totalSimulatedPnl - totalOriginalPnl).toFixed(2)}`,
	);
	console.log('-'.repeat(90));
	console.log(`ORIGINAL SL TRADES:       ${slTradesCount}`);
	console.log(`TRADES CONVERTED TO WIN:  ${convertedToWin}`);
	console.log('-'.repeat(90));

	await redis.quit();
}

main().catch(console.error);
