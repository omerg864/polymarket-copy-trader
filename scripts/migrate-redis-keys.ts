/**
 * Redis Key Migration Script (v3)
 * Transitions all old keys to the new mode-prefixed structure.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Redis from 'ioredis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', 'copy-bot', '.env') });

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const PREFIX = 'pmbot:';

async function main() {
	const redis = new Redis(REDIS_URL);
	console.log('🔗 Connected to Redis');

	// 1. Migrate Start Time
	const oldStartTime = await redis.get(`${PREFIX}state:start_time`);
	if (oldStartTime) {
		// Assume demo for now or move to both just in case
		await redis.set(`${PREFIX}demo:start_time`, oldStartTime);
		await redis.set(`${PREFIX}live:start_time`, oldStartTime);
		console.log('✅ Migrated Start Time');
	}

	// 2. Migrate Stop Requested
	const oldStopReq = await redis.get(`${PREFIX}state:stop_requested`);
	if (oldStopReq) {
		await redis.set(`${PREFIX}demo:stop_requested`, oldStopReq);
		await redis.set(`${PREFIX}live:stop_requested`, oldStopReq);
		console.log('✅ Migrated Stop Requested');
	}

	// 3. Migrate Active Trades and Individual Trade Keys
	const activeIds = await redis.smembers(`${PREFIX}active_trades`);
	for (const id of activeIds) {
		const rawTrade = await redis.get(`${PREFIX}trade:${id}`);
		if (rawTrade) {
			const trade = JSON.parse(rawTrade);
			const mode = trade.type === 'live' ? 'live' : 'demo';

			await redis.set(`${PREFIX}${mode}:trade:${id}`, rawTrade);
			await redis.sadd(`${PREFIX}${mode}:active_trades`, id);
			console.log(`✅ Migrated Active Trade: ${id} (${mode})`);
		}
	}

	// 4. Migrate History List
	const history = await redis.lrange(`${PREFIX}history`, 0, -1);
	for (const rawTrade of history) {
		const trade = JSON.parse(rawTrade);
		const mode = trade.type === 'live' ? 'live' : 'demo';
		await redis.rpush(`${PREFIX}${mode}:history`, rawTrade);
	}
	console.log(`✅ Migrated History (${history.length} items)`);

	// 5. Migrate History IDs Set
	const historyIds = await redis.smembers(`${PREFIX}history_ids`);
	// We need to look up type for each ID or just push all to demo if we can't find them
	// But since we have the history list we just migrated, let's use that
	for (const rawTrade of history) {
		const trade = JSON.parse(rawTrade);
		const mode = trade.type === 'live' ? 'live' : 'demo';
		await redis.sadd(`${PREFIX}${mode}:history_ids`, trade.id);
	}
	console.log('✅ Migrated History IDs');

	console.log('\n🚀 Migration completed successfully!');
	console.log('\n--- Cleanup Note ---');
	console.log(
		'Old keys were LEFT INTACT for safety. You can manually delete them later:',
	);
	console.log(`- ${PREFIX}history`);
	console.log(`- ${PREFIX}history_ids`);
	console.log(`- ${PREFIX}active_trades`);
	console.log(`- ${PREFIX}trade:*`);
	console.log(`- ${PREFIX}state:*`);

	await redis.quit();
}

main().catch(console.error);
