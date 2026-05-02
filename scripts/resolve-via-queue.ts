/**
 * Resolve stuck trades via official bot queue Service.
 * 1. Checks if job already exists in 'sell-trades' queue.
 * 2. Adds RESOLVE job if missing.
 * 3. Starts workers to process the jobs using official bot logic.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load production environment
dotenv.config({
	path: path.resolve(__dirname, '..', 'copy-bot', '.env.production.local'),
});

// We need to set some env vars that the bot services expect
process.env.MODE = 'demo'; // The 4 stuck trades are demo mode

// We need to set some env vars that the bot services expect
process.env.MODE = 'demo'; // The 4 stuck trades are demo mode

const STUCK_TRADE_IDS = [
	'37f56d70-b5c3-4018-acfa-18c1bb41efc3',
	'01413c73-0120-40f2-9ce1-2f856703a05b',
	'f1b43a95-164c-46da-928e-9da85bc1694e',
	'cae7ebf3-25b3-4a4e-829a-e1ca83b04ea8',
];

async function main() {
	console.log('🚀 Starting Resolution via Queue...');

	// 1. Initialize services
	const { default: redisService } =
		await import('../copy-bot/src/services/redis');
	const { default: queueService } =
		await import('../copy-bot/src/services/queueService');
	const { default: polymarketService } =
		await import('../copy-bot/src/services/polymarket');

	await redisService.connect();
	await polymarketService.initialize();

	// 2. Check and Add Jobs
	// We use the same queue name as in queueService: 'sell-trades'
	// Note: queueService.sellQueue is private, so we create a temporary queue handle for auditing
	const connection = new Redis(process.env.REDIS_URL!, {
		maxRetriesPerRequest: null,
	});
	const sellQueue = new Queue('sell-trades', { connection });

	// 2. Discover all expired trades from Redis
	const activeIds = await redisService.getActiveTrades();
	const expiredTrades: any[] = [];
	const now = new Date();

	for (const t of activeIds) {
		if (t.status === 'open' && new Date(t.endTime) < now) {
			expiredTrades.push(t);
		}
	}

	if (expiredTrades.length === 0) {
		console.log('✅ No expired trades found in Redis.');
	} else {
		console.log(
			`🔍 Found ${expiredTrades.length} expired trade(s). Ensuring they are in the queue...`,
		);
	}

	for (const trade of expiredTrades) {
		const id = trade.id;
		const existingJob = await sellQueue.getJob(id);
		if (existingJob) {
			const state = await existingJob.getState();
			console.log(
				`⚠️  Job ${id} already exists in queue (Status: ${state}).`,
			);

			if (state === 'failed') {
				console.log(`❌ Failure reason: ${existingJob.failedReason}`);
				console.log(`🔄 Retrying failed job ${id}...`);
				await existingJob.retry();
				continue;
			} else if (state === 'completed') {
				console.log(
					`✅ Job already completed successfully once. Skipping.`,
				);
				continue;
			} else {
				console.log(
					`⏳ Job is in state ${state}. Waiting for worker to pick it up.`,
				);
				continue;
			}
		}

		console.log(`📦 Adding RESOLVE job for: ${trade.title} (${id})`);

		await queueService.addSellJob({
			trade,
			type: 'RESOLVE',
		});
	}

	// 3. Start workers to process the jobs
	console.log('\n⚙️  Starting workers to process jobs...');
	await queueService.startWorkers();

	// 4. Monitor workers (we'll just wait a bit or listen for events)
	console.log('⏳ Monitoring worker activity (1 minute timeout)...');

	// The workers in queueService already log to 'logger'
	// We'll keep the script alive for a minute to allow processing
	let completedCount = 0;
	const timeout = setTimeout(async () => {
		console.log('\n🛑 Timeout reached. Stopping workers.');
		await queueService.stopWorkers();
		await connection.quit();
		process.exit(0);
	}, 60000);

	// Re-check active trades every 10s to see if done
	const checkInterval = setInterval(async () => {
		const activeIds = await redisService.getActiveTrades();
		const stuckStillActive = activeIds.filter((t) =>
			STUCK_TRADE_IDS.includes(t.id),
		);

		if (stuckStillActive.length === 0) {
			console.log(
				'\n✅ All targeted trades have been resolved and moved to history!',
			);
			clearTimeout(timeout);
			clearInterval(checkInterval);
			await queueService.stopWorkers();
			await connection.quit();
			process.exit(0);
		} else {
			console.log(
				`⏳ ${stuckStillActive.length} trade(s) still processing...`,
			);
		}
	}, 10000);
}

main().catch((err) => {
	console.error('\n❌ Fatal Error:', err);
	process.exit(1);
});
