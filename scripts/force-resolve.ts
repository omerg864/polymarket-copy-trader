/**
 * Manual Force Resolve Script
 * Enqueues a specific trade into the new BullMQ sell/resolve queue.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', 'copy-bot', '.env') });

import Redis from 'ioredis';
import { Queue } from 'bullmq';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const tradeId = '7558c915-45cf-427b-980b-3a0973bfec64';

async function main() {
	const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
	console.log('Connected to Redis');

	const rawTrade = await redis.get(`pmbot:trade:${tradeId}`);
	if (!rawTrade) {
		console.error(`Trade ${tradeId} not found in Redis!`);
		process.exit(1);
	}

	const trade = JSON.parse(rawTrade);
	console.log(`Found trade: ${trade.title}`);
	console.log(`Status: ${trade.status}`);

	const queue = new Queue('sell-trades', { connection: redis as any });

	console.log('Enqueuing RESOLVE job...');
	await queue.add(
		`sell-${trade.id}`,
		{
			trade,
			type: 'RESOLVE',
			btcPrice: 70802, // Current approximate price from my investigation
		},
		{
			jobId: trade.id,
			attempts: 30,
			backoff: { type: 'fixed', delay: 30000 },
		},
	);

	console.log('✅ Job enqueued successfully');

	// Wait a bit to see if keys appear
	await new Promise((r) => setTimeout(r, 2000));
	const keys = await redis.keys('*bull:*');
	console.log('Current BullMQ keys in Redis:', keys);

	await redis.quit();
}

main().catch((err) => {
	console.error('Error:', err);
	process.exit(1);
});
