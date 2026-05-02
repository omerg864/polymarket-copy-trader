/**
 * Deep investigation of active trades in production Redis.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Redis from 'ioredis';
import { DateTime } from 'luxon';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load production environment
dotenv.config({
	path: path.resolve(__dirname, '..', 'copy-bot', '.env.production.local'),
});

const REDIS_URL = process.env.REDIS_URL;
const PREFIX = 'pmbot:';
const MODES = ['live', 'demo'];

async function main() {
	if (!REDIS_URL) {
		console.error('❌ REDIS_URL not found in .env.production.local');
		process.exit(1);
	}

	console.log(
		`\n🔍 Investigating Redis: ${REDIS_URL.split('@')[1] || REDIS_URL}`,
	);
	const redis = new Redis(REDIS_URL);

	for (const mode of MODES) {
		console.log(`\n--- MODE: ${mode.toUpperCase()} ---`);
		const activeTradesKey = `${PREFIX}${mode}:active_trades`;
		const tradeIds = await redis.smembers(activeTradesKey);

		if (tradeIds.length === 0) {
			console.log(`✅ No active trades found for ${mode}.`);
			continue;
		}

		console.log(`Found ${tradeIds.length} active trade(s):`);

		for (const id of tradeIds) {
			const tradeKey = `${PREFIX}${mode}:trade:${id}`;
			const rawTrade = await redis.get(tradeKey);

			if (!rawTrade) {
				console.log(
					`⚠️  Trade ID ${id} exists in active set but trade object is MISSING!`,
				);
				continue;
			}

			const trade = JSON.parse(rawTrade);
			const now = DateTime.now();
			const endTime = DateTime.fromISO(trade.endTime);
			const diff = now.diff(endTime, ['minutes', 'seconds']).toObject();
			const isExpired = now > endTime;

			console.log(`\nTrade ID: ${id}`);
			console.log(`  Title:      ${trade.title}`);
			console.log(`  Direction:  ${trade.direction}`);
			console.log(`  EntryPrice: ${trade.entryPrice}`);
			console.log(`  RefPrice:   ${trade.priceToBeat}`);
			console.log(`  Status:     ${trade.status}`);
			console.log(`  Condition:  ${trade.conditionId}`);
			console.log(`  Start Time: ${trade.startTime}`);
			console.log(`  End Time:   ${trade.endTime}`);
			console.log(`  Expired:    ${isExpired ? '🚨 YES' : '⏳ NO'}`);

			if (isExpired) {
				console.log(
					`  Overdue by: ${Math.floor(diff.minutes || 0)}m ${Math.floor(diff.seconds || 0)}s`,
				);
			} else {
				console.log(
					`  Time left:  ${Math.floor(Math.abs(diff.minutes || 0))}m ${Math.floor(Math.abs(diff.seconds || 0))}s`,
				);
			}

			// Check for market cache
			const marketKey = `${PREFIX}market:${trade.conditionId}`;
			const marketCache = await redis.get(marketKey);
			console.log(
				`  Market Cache: ${marketCache ? '✅ Found' : '❌ Missing'}`,
			);

			if (isExpired) {
				console.log(`\n  --- FULL JSON ---`);
				console.log(JSON.stringify(trade, null, 2));
				console.log(`  -----------------`);
			}
		}
	}

	await redis.quit();
	console.log('\n✅ Investigation complete.\n');
}

main().catch((err) => {
	console.error('\n❌ Fatal Error:', err);
	process.exit(1);
});
