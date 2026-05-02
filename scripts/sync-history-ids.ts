/**
 * Sync script: Ensure pmbot:history_ids set perfectly matches pmbot:history list.
 * The history list is considered the source of truth.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
	path: path.resolve(__dirname, '..', 'copy-bot', '.env.production.local'),
});

import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const PREFIX = 'pmbot:';
const MODE = process.env.MODE || 'demo';

async function main() {
	const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 3 });
	console.log('Connected to Redis\n');

	const historyKey = `${PREFIX}${MODE}:history`;
	const historyIdsKey = `${PREFIX}${MODE}:history_ids`;

	const historyLen = await redis.llen(historyKey);
	console.log(`History list length: ${historyLen}`);

	if (historyLen === 0) {
		console.log('History list is empty. Clearing the IDs set...');
		await redis.del(historyIdsKey);
		await redis.quit();
		return;
	}

	// Fetch all IDs from history list
	const currentIds = new Set<string>();
	for (let i = 0; i < historyLen; i++) {
		const raw = await redis.lindex(historyKey, i);
		if (!raw) continue;
		try {
			const trade = JSON.parse(raw);
			if (trade.id) currentIds.add(trade.id);
		} catch (e) {
			console.error(`Failed to parse trade at index ${i}`);
		}
	}

	console.log(`Unique IDs found in history list: ${currentIds.size}`);

	// Replace the set atomically using a temp key or just SADD everything
	// To be safe and "sync", we should probably SREM things not in list,
	// but simplest is to just overwrite or clear and re-add.

	// Atomic replace isn't built-in for SET from LIST, so we'll just clear and rebuild.
	await redis.del(historyIdsKey);
	if (currentIds.size > 0) {
		const idsArray = Array.from(currentIds);
		// SADD can take multiple arguments
		await redis.sadd(historyIdsKey, ...idsArray);
	}

	console.log(
		`✅ Sync complete. ${historyIdsKey} now contains ${currentIds.size} IDs.`,
	);
	await redis.quit();
}

main().catch((err) => {
	console.error('Error:', err);
	process.exit(1);
});
