/**
 * Fix trade status to "won" and analyze PnL by day.
 */
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
const MODE = process.env.MODE || 'production';

const TARGET_TRADE_IDS = [
	'fcbaa68c-c826-4d25-b691-2b26042861e9',
	'1c1dc021-2f8f-4480-9844-5cdaabc82af6',
];

async function main() {
	const redis = new Redis(REDIS_URL);
	console.log(`Connected to Redis (MODE: ${MODE})\n`);

	const historyKey = `${PREFIX}${MODE}:history`;
	const historyRaw = await redis.lrange(historyKey, 0, -1);
	const history = historyRaw.map(r => JSON.parse(r));

	console.log('--- Updating Target Trades ---');
	for (const id of TARGET_TRADE_IDS) {
		const index = history.findIndex(t => t.id === id);
		if (index !== -1) {
			const trade = history[index];
			trade.status = 'won'; // Explicitly set to "won"
			await redis.lset(historyKey, index, JSON.stringify(trade));
			console.log(`  Updated trade ${id} to status: won`);
		} else {
			console.warn(`  Trade ${id} not found in history.`);
		}
	}

	console.log('\n--- Analyzing PnL by Day (Asia/Jerusalem) ---');
	const dayPnls: Record<string, number> = {};
	
	history.forEach(t => {
		if (!t.enteredAt) return;
		const day = DateTime.fromISO(t.enteredAt).setZone('Asia/Jerusalem').toISODate() || 'unknown';
		dayPnls[day] = (dayPnls[day] || 0) + (t.pnl || 0);
	});

	const days = Object.keys(dayPnls).sort();
	let totalPnl = 0;
	days.forEach(day => {
		console.log(`  ${day}: $${dayPnls[day].toFixed(4)}`);
		totalPnl += dayPnls[day];
	});

	console.log(`\n  Calculated Total PnL (from days): $${totalPnl.toFixed(4)}`);

	await redis.quit();
}

main().catch(console.error);
