/**
 * Migration script: Populate pmbot:history_ids set from pmbot:history list.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', 'copy-bot', '.env') });

import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const PREFIX = 'pmbot:';

async function main() {
	const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 3 });
	console.log('Connected to Redis\n');

	const historyKey = `${PREFIX}history`;
	const historyIdsKey = `${PREFIX}history_ids`;

	const historyLen = await redis.llen(historyKey);
	console.log(`History length: ${historyLen}`);

	if (historyLen === 0) {
		console.log('No history to migrate.');
		await redis.quit();
		return;
	}

	let addedCount = 0;
	for (let i = 0; i < historyLen; i++) {
		const raw = await redis.lindex(historyKey, i);
		if (!raw) continue;

		try {
			const trade = JSON.parse(raw);
			if (trade.id) {
				const added = await redis.sadd(historyIdsKey, trade.id);
				if (added) addedCount++;
			}
		} catch (e) {
			console.error(`Failed to parse trade at index ${i}`);
		}
	}

	console.log(
		`✅ Migration complete. Added ${addedCount} unique IDs to ${historyIdsKey}.`,
	);
	await redis.quit();
}

main().catch((err) => {
	console.error('Error:', err);
	process.exit(1);
});
