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

/**
 * SIMULATION RULES:
 * 1. New SL is 30% (original 20% + 10% more).
 * 2. If actualOutcome !== direction -> LOSS (30% of cost).
 * 3. Special Rule: If entryPrice > 0.85 -> Always LOSS (30% of cost).
 * 4. Special Rule: If entryPrice <= 0.85 AND actualOutcome === direction -> WIN.
 * 5. Everything else (e.g. unknown outcome) is skipped.
 */

async function main() {
	const redis = new Redis(REDIS_URL);
	console.log(
		`Connected to Redis. Running SL Adjustment (30%) & Entry Price (0.85) Simulation...\n`,
	);

	const historyKey = `${PREFIX}${MODE}:history`;
	const historyLen = await redis.llen(historyKey);

	let totalOriginalPnl = 0;
	let totalSimulatedPnl = 0;
	let totalTrades = 0;

	let convertedToWin = 0;
	let convertedToLoss = 0;
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

		// Simulation Rules ONLY for original Stop Loss trades
		if (originalStatus === 'closed_sl') {
			slTradesCount++;

			if (t.entryPrice > 0.85) {
				// Rule: If entry > 0.85, it's a loss, simulated at 30% SL
				simPnl = -(0.3 * cost + fee);
				simStatus = 'sim_loss_high_entry';
				stayedLoss++;
			} else if (isOutcomeMatch) {
				// Rule: If entry <= 0.85 and outcome matches, convert to WIN
				simPnl = (1 / t.entryPrice - 1) * cost - fee;
				simStatus = 'sim_win';
				convertedToWin++;
			} else {
				// Rule: Outcome didn't match, increase loss to 30% SL
				simPnl = -(0.3 * cost + fee);
				simStatus = 'sim_loss';
				stayedLoss++;
			}
		} else {
			// Rule: Original Winners (or other statuses) are preserved
			if (originalPnl > 0) stayedWin++;
			else stayedLoss++;
		}

		const isWinOrig = originalPnl > 0;
		const isWinSim = simPnl > 0;

		if (!isWinOrig && isWinSim) convertedToWin++;
		else if (isWinOrig && !isWinSim) convertedToLoss++;
		else if (!isWinOrig && !isWinSim) stayedLoss++;
		else if (isWinOrig && isWinSim) stayedWin++;

		if (originalStatus === 'closed_sl') slTradesCount++;

		totalOriginalPnl += originalPnl;
		totalSimulatedPnl += simPnl;
		totalTrades++;

		// Log if it was an SL trade or if its win/loss status changed
		if (originalStatus === 'closed_sl' || isWinOrig !== isWinSim) {
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
	console.log(`TRADES CONVERTED TO LOSS: ${convertedToLoss}`);
	console.log(`ORIGINAL SL TRADES:       ${slTradesCount}`);
	console.log('-'.repeat(90));

	await redis.quit();
}

main().catch(console.error);
