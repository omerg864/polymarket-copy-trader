/**
 * Local Worker Starter
 * Starts the BullMQ workers locally to process jobs in the cloud Redis.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', 'copy-bot', '.env') });

import queueService from '../copy-bot/src/services/queueService';
import logger from '../copy-bot/src/utils/logger';

import Redis from 'ioredis';

async function main() {
	const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
	console.log('🚀 Starting BullMQ workers locally...');

	const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
	await redis.connect().catch(() => {}); // handle already connected or errors
	console.log('🔗 Connected to Redis');

	const { queueService } =
		await import('../copy-bot/src/services/queueService');

	// Listen for worker completions/failures in the script for visibility
	(queueService as any).sellWorker.on('completed', (job: any) =>
		console.log(`✅ Sell Worker completed job: ${job.id}`),
	);
	(queueService as any).sellWorker.on('failed', (job: any, err: any) =>
		console.log(`❌ Sell Worker failed job ${job?.id}: ${err.message}`),
	);
	(queueService as any).completionWorker.on('completed', (job: any) =>
		console.log(`✅ Completion Worker completed job: ${job.id}`),
	);
	(queueService as any).completionWorker.on('failed', (job: any, err: any) =>
		console.log(
			`❌ Completion Worker failed job ${job?.id}: ${err.message}`,
		),
	);

	console.log('Workers are now active and listening to cloud Redis.');
	console.log('Press Ctrl+C to stop.');

	// Keep alive
	setInterval(() => {}, 1000);
}

main().catch((err) => {
	console.error('Fatal error:', err);
	process.exit(1);
});
