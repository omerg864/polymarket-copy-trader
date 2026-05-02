import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Redis from 'ioredis';
import { DateTime } from 'luxon';
import mongoose, { Schema } from 'mongoose';

// Setup paths
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
	path: path.resolve(__dirname, '..', 'copy-bot', '.env.production.local'),
});

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const MONGO_URI =
	process.env.MONGO_URI || 'mongodb://localhost:27017/polymarket-bot';
const PREFIX = 'pmbot:';
const MODE = process.env.MODE || 'demo';

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
		`\n🚀 Starting Time Windows Simulation (00:00-01:59 & 11:00-00:00)`,
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
	const statsByDay: Record<string, any> = {};

	// Helper to get date string in timezone
	const getDateStr = (iso: string) =>
		DateTime.fromISO(iso).setZone(timezone).toISODate() || 'unknown';

	// Helper to check if time is in allowed window
	const isAllowedTime = (iso: string) => {
		const dt = DateTime.fromISO(iso).setZone(timezone);
		const hour = dt.hour;

		// Window 1: 00:00 to 01:59 (Hours 0 and 1)
		if (hour >= 0 && hour <= 1) return true;

		// Window 2: 11:00 to 23:59 (Hours 11 through 23)
		if (hour >= 11 && hour <= 23) return true;

		return false;
	};

	for (const t of allTrades) {
		const entryDate = t.enteredAt;
		if (!entryDate) continue;

		const day = getDateStr(t.closedAt || entryDate);
		if (!statsByDay[day]) {
			statsByDay[day] = {
				actPnL: 0,
				actWins: 0,
				actTrades: 0,
				simPnL: 0,
				simWins: 0,
				simTrades: 0,
			};
		}

		statsByDay[day].actPnL += t.pnl || 0;
		statsByDay[day].actTrades++;
		if ((t.pnl || 0) >= 0) statsByDay[day].actWins++;

		if (isAllowedTime(entryDate)) {
			statsByDay[day].simPnL += t.pnl || 0;
			statsByDay[day].simTrades++;
			if ((t.pnl || 0) >= 0) statsByDay[day].simWins++;
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
	console.log('-'.repeat(110));
	console.log(
		`${'Date'.padEnd(12)} | ${'Act PnL'.padStart(10)} | ${'Sim PnL'.padStart(10)} | ${'Act WR%'.padStart(8)} | ${'Sim WR%'.padStart(8)} | ${'Trades(A/S)'.padStart(12)}`,
	);
	console.log('-'.repeat(110));

	for (const day of sortedDates) {
		const s = statsByDay[day];
		const actWR = s.actTrades > 0 ? (s.actWins / s.actTrades) * 100 : 0;
		const simWR = s.simTrades > 0 ? (s.simWins / s.simTrades) * 100 : 0;

		console.log(
			`${day.padEnd(12)} | ${s.actPnL.toFixed(2).padStart(10)} | ${s.simPnL.toFixed(2).padStart(10)} | ` +
				`${actWR.toFixed(1).padStart(7)}% | ${simWR.toFixed(1).padStart(7)}% | ` +
				`${(s.actTrades + '/' + s.simTrades).padStart(12)}`,
		);

		totalActPnL += s.actPnL;
		totalSimPnL += s.simPnL;
		totalActTrades += s.actTrades;
		totalSimTrades += s.simTrades;
		totalActWins += s.actWins;
		totalSimWins += s.simWins;
	}

	console.log('-'.repeat(110));
	console.log('\nOVERALL SUMMARY:');
	console.log('-'.repeat(55));
	console.log(
		`${'METRIC'.padEnd(20)} | ${'ACTUAL'.padStart(14)} | ${'SIMULATED'.padStart(14)}`,
	);
	console.log(
		`${'Total PnL:'.padEnd(20)} | $ ${totalActPnL.toFixed(2).padStart(12)} | $ ${totalSimPnL.toFixed(2).padStart(12)}`,
	);
	console.log(
		`${'Total Trades:'.padEnd(20)} | ${totalActTrades.toString().padStart(14)} | ${totalSimTrades.toString().padStart(14)}`,
	);
	const actWRTotal =
		totalActTrades > 0 ? (totalActWins / totalActTrades) * 100 : 0;
	const simWRTotal =
		totalSimTrades > 0 ? (totalSimWins / totalSimTrades) * 100 : 0;
	console.log(
		`${'Win Rate:'.padEnd(20)} | ${actWRTotal.toFixed(2).padStart(13)}% | ${simWRTotal.toFixed(2).padStart(13)}%`,
	);
	console.log(
		`${'Avg Daily PnL:'.padEnd(20)} | $ ${(totalActPnL / sortedDates.length).toFixed(2).padStart(12)} | $ ${(totalSimPnL / sortedDates.length).toFixed(2).padStart(12)}`,
	);
	const diff = totalSimPnL - totalActPnL;
	console.log(
		`\nIMPACT: ${diff >= 0 ? '🟢 PROFIT INCREASED BY $' : '🔴 PROFIT DECREASED BY $'}${Math.abs(diff).toFixed(2)}`,
	);

	await redis.quit();
	await mongoose.disconnect();
}

main().catch(console.error);
