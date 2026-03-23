import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Redis from 'ioredis';
import { DateTime } from 'luxon';

// Setup paths
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
	path: path.resolve(__dirname, '..', 'btc5-bot', '.env.production.local'),
});

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const PREFIX = 'pmbot:';
const MODE = process.env.MODE || 'demo';
const TARGET_SL_PRICE = 0.4;

/**
 * SIMULATION RULES:
 * 1. SL is fixed at 0.4 market price.
 * 2. If original status was 'closed_sl':
 *    - If actualOutcome === direction: Convert to WIN (assume survival).
 *    - Else (actualOutcome !== direction): Recalculate loss as hitting 0.4 price.
 *      New PnL = ((0.4 / entryPrice) - 1) * cost - fee
 * 3. Original winners (or other statuses) are preserved.
 */

async function main() {
	const redis = new Redis(REDIS_URL);
	console.log(
		`Connected to Redis. Running Market Price SL (Fixed at ${TARGET_SL_PRICE}) Simulation...\n`,
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
	let stayedLoss = 0;
	let stayedWin = 0;
	let slTradesCount = 0;

	console.log('--- Interesting Trade Simulations (Conversions or SL) ---');
	console.log(
		'ID'.padEnd(10),
		'| Outcome | Entry | Dir | Orig Status | Orig PnL | Sim PnL | Change',
	);
	console.log('-'.repeat(90));

	for (let i = 0; i < historyLen; i++) {
		const raw = await redis.lindex(historyKey, i);
		if (!raw) continue;
		const t = JSON.parse(raw);

		if (!t.actualOutcome || t.actualOutcome === 'UNKNOWN') continue;

		const originalStatus = t.status;
		const originalPnl = t.pnl || 0;
		const cost = t.cost || 0;
		const fee = t.fee || 0;

		let simPnl = originalPnl;
		let simStatus = originalStatus;

		const isOutcomeMatch = t.actualOutcome === t.direction;
		const date =
			DateTime.fromISO(t.enteredAt).setZone(timezone).toISODate() ||
			'unknown';

		if (!dailyStats[date]) {
			dailyStats[date] = { pnl: 0, origPnl: 0, count: 0, conversions: 0 };
		}

		// Simulation Rules ONLY for original Stop Loss trades
		if (originalStatus === 'closed_sl') {
			slTradesCount++;

			if (isOutcomeMatch) {
				// Rule: If outcome matches, convert to WIN (survived 0.4)
				simPnl = (1 / t.entryPrice - 1) * cost - fee;
				simStatus = 'sim_win';
				convertedToWin++;
				dailyStats[date].conversions++;
			} else {
				// Rule: Outcome didn't match, calculate loss at 0.4 target
				if (t.entryPrice > TARGET_SL_PRICE) {
					simPnl = (TARGET_SL_PRICE / t.entryPrice - 1) * cost - fee;
				} else {
					// Entry was already <= 0.4, use total loss or original
					simPnl = -cost - fee;
				}
				simStatus = 'sim_loss_0.4';
				stayedLoss++;
			}
		} else {
			if (originalPnl > 0) stayedWin++;
			else stayedLoss++;
		}

		dailyStats[date].pnl += simPnl;
		dailyStats[date].origPnl += originalPnl;
		dailyStats[date].count++;

		totalOriginalPnl += originalPnl;
		totalSimulatedPnl += simPnl;
		totalTrades++;

		// Log if it was an SL trade or if its win/loss status changed
		if (originalStatus === 'closed_sl') {
			console.log(
				`${t.id.substring(0, 8).padEnd(10)} | ` +
					`${t.actualOutcome.padEnd(7)} | ` +
					`${t.entryPrice.toFixed(3).padEnd(5)} | ` +
					`${t.direction.padEnd(3)} | ` +
					`${originalStatus.padEnd(11)} | ` +
					`${originalPnl.toFixed(2).padStart(8)} | ` +
					`${simPnl.toFixed(2).padStart(7)} | ` +
					`${(simPnl - originalPnl).toFixed(2).padStart(6)}`,
			);
		}
	}

	console.log('\n--- Daily Simulation ---');
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
	console.log(`STAYED WIN:             ${stayedWin}`);
	console.log(`STAYED LOSS:            ${stayedLoss}`);
	console.log(`TRADES CONVERTED TO WIN:  ${convertedToWin}`);
	console.log(`ORIGINAL SL TRADES:       ${slTradesCount}`);
	console.log('-'.repeat(90));

	await redis.quit();
}

main().catch(console.error);
