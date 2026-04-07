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
	path: path.resolve(__dirname, '..', 'btc5-bot', '.env.production.local'),
});

// We need to set some env vars that the bot services expect
process.env.MODE = 'demo'; // The 4 stuck trades are demo mode

// We need to set some env vars that the bot services expect
process.env.MODE = 'demo'; // The 4 stuck trades are demo mode

const STUCK_TRADE_IDS = [
	'7bf27fc0-3dba-4379-91ce-fe7a6c6772f1',
	'd2f1e6e1-57be-4c43-8201-e381de1554a0',
	'5dff553b-c4f4-498b-bd9c-e6fe408f3861',
	'2364a800-0713-4908-93c5-768d0b1ca9e5',
];

async function main() {
	console.log('🚀 Starting Resolution via Queue...');

	// 1. Initialize services
    const { default: redisService } = await import('../btc5-bot/src/services/redis');
    const { default: queueService } = await import('../btc5-bot/src/services/queueService');
    const { default: polymarketService } = await import('../btc5-bot/src/services/polymarket');

	await redisService.connect();
	await polymarketService.initialize();

	// 2. Check and Add Jobs
	// We use the same queue name as in queueService: 'sell-trades'
    // Note: queueService.sellQueue is private, so we create a temporary queue handle for auditing
    const connection = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
    const sellQueue = new Queue('sell-trades', { connection });

	for (const id of STUCK_TRADE_IDS) {
		const existingJob = await sellQueue.getJob(id);
		if (existingJob) {
            const state = await existingJob.getState();
			console.log(`⚠️  Job ${id} already exists in queue (Status: ${state}).`);
            
            if (state === 'failed') {
                console.log(`❌ Failure reason: ${existingJob.failedReason}`);
                console.log(`🔄 Retrying failed job ${id}...`);
                await existingJob.retry();
                continue;
            } else if (state === 'completed') {
                console.log(`✅ Job already completed successfully once. Skipping.`);
                continue;
            } else {
                console.log(`⏳ Job is in state ${state}. Waiting for worker to pick it up.`);
                continue;
            }
		}

		const tradeKey = `pmbot:demo:trade:${id}`;
		const rawTrade = await redisService.getRaw(tradeKey);
		if (!rawTrade) {
			console.log(`❌ Trade ${id} not found in Redis (Key: ${tradeKey}). Skipping.`);
			continue;
		}

		const trade = JSON.parse(rawTrade);
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
        const stuckStillActive = activeIds.filter(t => STUCK_TRADE_IDS.includes(t.id));
        
        if (stuckStillActive.length === 0) {
            console.log('\n✅ All targeted trades have been resolved and moved to history!');
            clearTimeout(timeout);
            clearInterval(checkInterval);
            await queueService.stopWorkers();
            await connection.quit();
            process.exit(0);
        } else {
            console.log(`⏳ ${stuckStillActive.length} trade(s) still processing...`);
        }
    }, 10000);
}

main().catch((err) => {
	console.error('\n❌ Fatal Error:', err);
	process.exit(1);
});
