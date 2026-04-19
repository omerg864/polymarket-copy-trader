import { Queue } from 'bullmq';
import config from '../src/config';

async function checkQueue(queueName: string) {
    const queue = new Queue(queueName, {
        connection: { url: config.redisUrl }
    });

    console.log(`\n--- Queue: ${queueName} ---`);
    const waiting = await queue.getWaitingCount();
    const active = await queue.getActiveCount();
    const completed = await queue.getCompletedCount();
    const failed = await queue.getFailedCount();
    const delayed = await queue.getDelayedCount();

    console.log(`Waiting: ${waiting}`);
    console.log(`Active: ${active}`);
    console.log(`Completed: ${completed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Delayed: ${delayed}`);

    console.log('\n--- Failed Jobs ---');
    const failedJobs = await queue.getFailed();
    for (const job of failedJobs) {
        console.log(`Job ${job.id}: ${job.name}`);
        console.log(`Reason: ${job.failedReason}`);
        console.log(`Data: ${JSON.stringify(job.data)}`);
        console.log('---');
    }

    console.log('\n--- Active Jobs ---');
    const activeJobs = await queue.getActive();
    for (const job of activeJobs) {
      console.log(`Job ${job.id}: ${job.name}`);
      console.log(`Data: ${JSON.stringify(job.data)}`);
    }

    await queue.close();
}

async function main() {
    await checkQueue('sell-trades');
    await checkQueue('trade-completion');
}

main().catch(console.error);
