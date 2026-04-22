/**
 * Fix Legacy FCT Trade Status
 * Finds trades that were force-closed but have 'closed_sell' status and updates them to 'closed_fct'.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Redis from 'ioredis';
import { type Trade, TradeStatus } from '../shared/src/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', 'btc5-bot', '.env') });

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const PREFIX = 'pmbot:';

const redis = new Redis(REDIS_URL);

async function main() {
    console.log('🔗 Connected to Redis');

    for (const mode of ['live', 'demo'] as const) {
        console.log(`\n🚀 Checking ${mode.toUpperCase()} trades...`);
        const historyKey = `${PREFIX}${mode}:history`;
        const tradesRaw = await redis.lrange(historyKey, 0, -1);

        if (tradesRaw.length === 0) {
            console.log(`No ${mode} trades found.`);
            continue;
        }

        const updatedTrades: string[] = [];
        let updatedCount = 0;

        for (const tradeStr of tradesRaw) {
            const trade = JSON.parse(tradeStr) as Trade;

            // Only look for closed_sell trades
            if (trade.status !== TradeStatus.CLOSED_SELL) {
                updatedTrades.push(tradeStr);
                continue;
            }

            const closedAt = new Date(trade.closedAt!).getTime();
            const endTime = new Date(trade.endTime).getTime();
            const diffSec = (endTime - closedAt) / 1000;

            // If closed within 70s of end time and was not won/lost, it's likely an FCT
            if (diffSec < 70 && diffSec > 0) {
                console.log(`✨ Found FCT candidate: ${trade.id} (${trade.title}). Closed ${diffSec.toFixed(1)}s before end. Updating...`);
                trade.status = TradeStatus.CLOSED_FCT;
                updatedCount++;
            }

            updatedTrades.push(JSON.stringify(trade));
        }

        if (updatedCount > 0) {
            console.log(`💾 Saving ${updatedCount} updated trades to Redis for ${mode}...`);
            const pipeline = redis.pipeline();
            pipeline.del(historyKey);
            pipeline.rpush(historyKey, ...updatedTrades);
            await pipeline.exec();
        } else {
            console.log(`✅ No legacy FCT trades found for ${mode}.`);
        }
    }

    console.log('\n✨ Fix completed successfully!');
    await redis.quit();
}

main().catch((err) => {
    console.error('❌ Fix failed:', err);
    process.exit(1);
});
