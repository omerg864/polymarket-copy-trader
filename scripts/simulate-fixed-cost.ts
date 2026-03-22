import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Redis from 'ioredis';
import { DateTime } from 'luxon';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
	path: path.resolve(__dirname, '..', 'btc5-bot', '.env.production.local'),
});

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const PREFIX = 'pmbot:';
const MODE = process.env.MODE || 'demo';
const FIXED_COST = 70;

async function main() {
	const redis = new Redis(REDIS_URL);
	console.log(
		`Connected to Redis. Simulating with FIXED_COST=$${FIXED_COST}...\n`,
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
			count: number;
			originalPnl: number;
			originalCost: number;
		}
	> = {};
	let totalOriginalPnl = 0;
	let totalOriginalCost = 0;
	let totalSimulatedPnl = 0;
	let totalTrades = 0;

	for (let i = 0; i < historyLen; i++) {
		const raw = await redis.lindex(historyKey, i);
		if (!raw) continue;
		const t = JSON.parse(raw);

		if (t.cost <= 0) continue;

		const roi = t.pnl / t.cost;
		const simPnl = FIXED_COST * roi;

		const date =
			DateTime.fromISO(t.enteredAt).setZone(timezone).toISODate() ||
			'unknown';

		if (!dailyStats[date]) {
			dailyStats[date] = {
				pnl: 0,
				count: 0,
				originalPnl: 0,
				originalCost: 0,
			};
		}

		dailyStats[date].pnl += simPnl;
		dailyStats[date].count += 1;
		dailyStats[date].originalPnl += t.pnl;
		dailyStats[date].originalCost += t.cost;

		totalOriginalPnl += t.pnl;
		totalOriginalCost += t.cost;
		totalSimulatedPnl += simPnl;
		totalTrades += 1;
	}

	console.log('--- Daily Simulation ---');
	console.log(
		'Date'.padEnd(12),
		'| Trades | Orig PnL | Orig Cost | Sim PnL ($100)',
	);
	console.log('-'.repeat(65));

	const sortedDates = Object.keys(dailyStats).sort();
	for (const date of sortedDates) {
		const s = dailyStats[date];
		console.log(
			`${date.padEnd(12)} | ${s.count.toString().padEnd(6)} | ` +
				`${s.originalPnl.toFixed(2).padStart(8)} | ` +
				`${s.originalCost.toFixed(2).padStart(9)} | ` +
				`${s.pnl.toFixed(2).padStart(12)}`,
		);
	}

	console.log('\n' + '-'.repeat(65));
	console.log(`TOTAL TRADES:    ${totalTrades}`);
	console.log(`TOTAL ORIG COST: $${totalOriginalCost.toFixed(2)}`);
	console.log(
		`TOTAL ORIG PNL:  $${totalOriginalPnl.toFixed(2)} (${((totalOriginalPnl / totalOriginalCost) * 100).toFixed(2)}% ROI)`,
	);
	console.log(
		`TOTAL SIM PNL:   $${totalSimulatedPnl.toFixed(2)} (${((totalSimulatedPnl / (totalTrades * FIXED_COST)) * 100).toFixed(2)}% ROI)`,
	);
	console.log('-'.repeat(65));

	await redis.quit();
}

main().catch(console.error);
