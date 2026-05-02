import Redis from 'ioredis';
import config from '../src/config';

async function listActiveTrades() {
    const redis = new Redis(config.redisUrl);
    const mode = config.mode || (config.isDemo ? 'demo' : 'live');
    const activeKey = `pmbot:${mode}:active_trades`;
    const tradePrefix = `pmbot:${mode}:trade:`;

    console.log(`Checking key: ${activeKey}`);
    const ids = await redis.smembers(activeKey);
    console.log(`Found ${ids.length} active trade IDs:`, ids);

    for (const id of ids) {
        const tradeData = await redis.get(`${tradePrefix}${id}`);
        if (tradeData) {
            const trade = JSON.parse(tradeData);
            console.log(`\n--- Trade ${id} ---`);
            console.log(`Title: ${trade.title}`);
            console.log(`Direction: ${trade.direction}`);
            console.log(`Size: ${trade.size}`);
            console.log(`Status: ${trade.status}`);
            console.log(`Entered At: ${trade.enteredAt}`);
            console.log(`End Time: ${trade.endTime}`);
            console.log(`Market: ${trade.slug}`);
            console.log(`Cost: ${trade.cost}`);
            console.log(`TokenId: ${trade.tokenId}`);
            console.log(`ConditionId: ${trade.conditionId}`);
        } else {
            console.log(`\n--- Trade ${id} (Data missing in Redis!) ---`);
        }
    }

    await redis.quit();
}

listActiveTrades().catch(console.error);
