import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Redis from 'ioredis';
import { DateTime } from 'luxon';
import mongoose, { Schema } from 'mongoose';

// Setup paths
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
	path: path.resolve(__dirname, '..', 'btc5-bot', '.env.production.local'),
});

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const MONGO_URI =
	process.env.MONGO_URI || 'mongodb://localhost:27017/polymarket-bot';
const PREFIX = 'pmbot:';
const MODE = process.env.MODE || 'demo';

/**
 * CONFIGURATION
 */
const DAILY_TP_THRESHOLD = 160;
const DEFAULT_TIMEZONE = 'Asia/Jerusalem';

const tradeSchema = new Schema(
	{
		tradeId: String,
		type: String,
		direction: String,
		entryPrice: Number,
		exitPrice: Number,
		size: Number,
		cost: Number,
		fee: Number,
		status: String,
		enteredAt: String,
		closedAt: String,
		pnl: Number,
		actualOutcome: String,
	},
	{ timestamps: true },
);

const TradeModel =
	mongoose.models.Trade || mongoose.model('Trade', tradeSchema);

async function main() {
	console.log(
		`\n🚀 Starting Daily Take Profit Simulation (Threshold: $${DAILY_TP_THRESHOLD})`,
	);
	console.log(`Mode: ${MODE}\n`);

	const redis = new Redis(REDIS_URL);
	await mongoose.connect(MONGO_URI);

	const scRaw = await redis.get(`${PREFIX}strategy_config`);
	const sc = scRaw ? JSON.parse(scRaw) : {};
	const timezone = sc.timezone || DEFAULT_TIMEZONE;
	console.log(`Using Timezone: ${timezone}\n`);

	const allTrades = await TradeModel.find({
		type: MODE === 'live' ? 'live' : 'demo',
		status: {
			$in: [
				'closed_tp',
				'closed_sl',
				'closed_sell',
				'won',
				'lost',
				'closed_fct',
			],
		},
	}).lean();

	if (allTrades.length === 0) {
		console.log('No trades found to simulate.');
		process.exit(0);
	}

	// Simulation State
	const executedTradeIds = new Set<string>();
	const dailyRealizedPnL: Record<string, number> = {};
	const dayEvents: Record<string, any[]> = {};

	// Helper to get date string in timezone
	const getDateStr = (iso: string) =>
		DateTime.fromISO(iso).setZone(timezone).toISODate() || 'unknown';

	// Collect all events across all time
	const allEvents: any[] = [];
	for (const t of allTrades) {
		if (t.enteredAt) {
			allEvents.push({
				type: 'OPEN',
				time: new Date(t.enteredAt).getTime(),
				dateStr: getDateStr(t.enteredAt),
				trade: t,
			});
		}
		if (t.closedAt) {
			allEvents.push({
				type: 'CLOSE',
				time: new Date(t.closedAt).getTime(),
				dateStr: getDateStr(t.closedAt),
				trade: t,
			});
		}
	}

	// Sort all events chronologically
	allEvents.sort((a, b) => {
		if (a.time !== b.time) return a.time - b.time;
		return a.type === 'CLOSE' ? -1 : 1; // Close before Open for same timestamp
	});

	// Run Simulation
	for (const e of allEvents) {
		const day = e.dateStr;
		if (dailyRealizedPnL[day] === undefined) dailyRealizedPnL[day] = 0;

		if (e.type === 'OPEN') {
			if (dailyRealizedPnL[day] < DAILY_TP_THRESHOLD) {
				executedTradeIds.add(e.trade.tradeId);
			}
		} else {
			// CLOSE
			if (executedTradeIds.has(e.trade.tradeId)) {
				dailyRealizedPnL[day] += e.trade.pnl || 0;
			}
		}
	}

	// Stats Calculation
	const statsByDay: Record<string, any> = {};
	for (const t of allTrades) {
		const day = getDateStr(t.closedAt || t.enteredAt);
		if (!statsByDay[day]) {
			statsByDay[day] = {
				actPnL: 0,
				actWins: 0,
				actTrades: 0,
				simPnL: 0,
				simWins: 0,
				simTrades: 0,
				tpHit: false,
			};
		}

		statsByDay[day].actPnL += t.pnl || 0;
		statsByDay[day].actTrades++;
		if ((t.pnl || 0) >= 0) statsByDay[day].actWins++;

		if (executedTradeIds.has(t.tradeId)) {
			statsByDay[day].simPnL += t.pnl || 0;
			statsByDay[day].simTrades++;
			if ((t.pnl || 0) >= 0) statsByDay[day].simWins++;
		} else {
			// Check if it was skipped due to TP
			const entryDay = getDateStr(t.enteredAt);
			// This is a bit simplified, but if it wasn't executed, it's because TP was hit on entryDay
			statsByDay[entryDay] = statsByDay[entryDay] || {
				actPnL: 0,
				actWins: 0,
				actTrades: 0,
				simPnL: 0,
				simWins: 0,
				simTrades: 0,
				tpHit: false,
			};
			statsByDay[entryDay].tpHit = true;
		}
	}

	const sortedDates = Object.keys(statsByDay).sort();
	let totalActPnL = 0,
		totalSimPnL = 0;
	let totalActTrades = 0,
		totalSimTrades = 0;
	let totalActWins = 0,
		totalSimWins = 0;

	console.log('Daily Breakdown (by Closure Date):');
	console.log('-'.repeat(120));
	console.log(
		`${'Date'.padEnd(12)} | ${'Act PnL'.padStart(10)} | ${'Sim PnL'.padStart(10)} | ${'Act WR%'.padStart(8)} | ${'Sim WR%'.padStart(8)} | ${'Trades(A/S)'.padStart(12)} | ${'TP Hit?'.padStart(8)}`,
	);
	console.log('-'.repeat(120));

	for (const day of sortedDates) {
		const s = statsByDay[day];
		const actWR = s.actTrades > 0 ? (s.actWins / s.actTrades) * 100 : 0;
		const simWR = s.simTrades > 0 ? (s.simWins / s.simTrades) * 100 : 0;

		console.log(
			`${day.padEnd(12)} | ${s.actPnL.toFixed(2).padStart(10)} | ${s.simPnL.toFixed(2).padStart(10)} | ` +
				`${actWR.toFixed(1).padStart(7)}% | ${simWR.toFixed(1).padStart(7)}% | ` +
				`${(s.actTrades + '/' + s.simTrades).padStart(12)} | ${s.tpHit ? '  YES' : '   no'}`,
		);

		totalActPnL += s.actPnL;
		totalSimPnL += s.simPnL;
		totalActTrades += s.actTrades;
		totalSimTrades += s.simTrades;
		totalActWins += s.actWins;
		totalSimWins += s.simWins;
	}

	console.log('-'.repeat(120));
	console.log('\nOVERALL SUMMARY:');
	console.log('-'.repeat(55));
	console.log(
		`${'METRIC'.padEnd(20)} | ${'ACTUAL'.padStart(14)} | ${'SIMULATED'.padStart(14)}`,
	);
	console.log(
		`${'Total PnL:'.padEnd(20)} | $${totalActPnL.toFixed(2).padStart(13)} | $${totalSimPnL.toFixed(2).padStart(13)}`,
	);
	console.log(
		`${'Total Trades:'.padEnd(20)} | ${totalActTrades.toString().padStart(14)} | ${totalSimTrades.toString().padStart(14)}`,
	);
	console.log(
		`${'Win Rate:'.padEnd(20)} | ${((totalActWins / totalActTrades) * 100).toFixed(2).padStart(13)}% | ${((totalSimWins / totalSimTrades) * 100).toFixed(2).padStart(13)}%`,
	);
	console.log(
		`${'Avg Daily PnL:'.padEnd(20)} | $${(totalActPnL / sortedDates.length).toFixed(2).padStart(13)} | $${(totalSimPnL / sortedDates.length).toFixed(2).padStart(13)}`,
	);
	const diff = totalSimPnL - totalActPnL;
	console.log(
		`\nIMPACT: ${diff >= 0 ? '🟢 PROFIT INCREASED BY $' : '🔴 PROFIT DECREASED BY $'}${Math.abs(diff).toFixed(2)}`,
	);

	await redis.quit();
	await mongoose.disconnect();
}

main().catch(console.error);
