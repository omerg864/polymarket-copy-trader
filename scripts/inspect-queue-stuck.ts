
import Redis from 'ioredis';
import { Queue } from 'bullmq';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
	path: path.resolve(__dirname, '..', 'btc5-bot', '.env.production.local'),
});

async function main() {
    const redis = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
    const sellQueue = new Queue('sell-trades', { connection: redis });
    const completionQueue = new Queue('trade-completion', { connection: redis });
    
    const stuckIds = [
        '37f56d70-b5c3-4018-acfa-18c1bb41efc3',
        '01413c73-0120-40f2-9ce1-2f856703a05b',
        'f1b43a95-164c-46da-928e-9da85bc1694e',
        'cae7ebf3-25b3-4a4e-829a-e1ca83b04ea8'
    ];

    console.log('--- Sell-Trades Queue Status ---');
    for (const id of stuckIds) {
        const job = await sellQueue.getJob(id);
        if (job) {
            const state = await job.getState();
            console.log(`Job ${id}: state=${state}, attempts=${job.attemptsMade}, failedReason=${job.failedReason}`);
        } else {
            console.log(`Job ${id}: NOT FOUND`);
        }
    }

    console.log('\n--- Trade-Completion Queue Status ---');
    for (const id of stuckIds) {
        const jobId = `complete-${id}`;
        const job = await completionQueue.getJob(jobId);
        if (job) {
            const state = await job.getState();
            console.log(`Job ${jobId}: state=${state}, attempts=${job.attemptsMade}, failedReason=${job.failedReason}`);
        } else {
            console.log(`Job ${jobId}: NOT FOUND`);
        }
    }
    
    const sellCounts = await sellQueue.getJobCounts();
    const compCounts = await completionQueue.getJobCounts();
    console.log('\nOverall Queue Counts:', { sell: sellCounts, completion: compCounts });
    
    await redis.quit();
}

main().catch(console.error);
