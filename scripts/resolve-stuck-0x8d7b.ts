
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Redis from 'ioredis';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', 'btc5-bot', '.env') });

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/polymarket-bot';
const PREFIX = 'pmbot:live:';
const tradeId = '0x8d7b767b9d0b6b9f72121395c9e1eb04a614c1dad3a5c657c73d683841db1145';

// Import Trade model (assuming we can't easily import it, we define it here or use raw mongo)
const tradeSchema = new mongoose.Schema({
    tradeId: String,
    status: String,
    exitPrice: Number,
    exitBtcPrice: Number,
    pnl: Number,
    pctChange: Number,
    actualOutcome: String,
    closedAt: String,
}, { strict: false });

const TradeModel = mongoose.models.Trade || mongoose.model('Trade', tradeSchema);

async function main() {
    console.log(`🚀 Starting surgical resolution for trade ${tradeId}...`);

    // 1. Connect to Redis
    const redis = new Redis(REDIS_URL);
    console.log('🔗 Connected to Redis');

    // 2. Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('🔗 Connected to MongoDB');

    // 3. Fetch trade from Redis
    const rawTrade = await redis.get(`${PREFIX}trade:${tradeId}`);
    if (!rawTrade) {
        console.error(`❌ Trade ${tradeId} not found in Redis! Check prefix and ID.`);
        process.exit(1);
    }

    const trade = JSON.parse(rawTrade);
    console.log(`📋 Found trade: ${trade.title} (${trade.direction})`);

    // 4. Verification (Safety Check)
    if (trade.status !== 'open') {
        console.warn(`⚠️ Trade status is '${trade.status}', not 'open'. Are you sure?`);
    }

    // 5. Calculate Resolution (LOSS)
    trade.exitPrice = 0;
    trade.exitBtcPrice = 77533.25; // From Gamma API investigation
    trade.actualOutcome = 'DOWN';
    trade.status = 'lost';
    trade.closedAt = new Date().toISOString();
    trade.pnl = -trade.cost - trade.fee; // Total loss
    trade.pctChange = -1.0; // 100% loss

    console.log(`💰 Calculated Loss: ${trade.pnl.toFixed(6)} USDC`);

    // 6. Update Redis Trace
    const pipeline = redis.pipeline();
    
    // Remove from active
    pipeline.srem(`${PREFIX}active_trades`, tradeId);
    pipeline.del(`${PREFIX}trade:${tradeId}`);
    
    // Add to history IDs (zset)
    const now = Date.now();
    pipeline.zadd(`${PREFIX}history_ids`, now, tradeId);
    
    // Update Stats
    const rawStats = await redis.get(`${PREFIX}stats`);
    if (rawStats) {
        const stats = JSON.parse(rawStats);
        stats.totalTrades += 1;
        stats.losses += 1;
        stats.totalPnl += trade.pnl;
        stats.totalFees += trade.fee;
        stats.lastUpdated = new Date().toISOString();
        pipeline.set(`${PREFIX}stats`, JSON.stringify(stats));
        console.log('📈 Updated Redis Stats:', stats);
    }

    // Note: Balance is NOT updated for a loss because cost+fee was already deducted at entry.
    // If it were a win, we would add the revenue (size * 1).

    await pipeline.exec();
    console.log('✅ Redis updates complete.');

    // 7. Update MongoDB
    const mongoUpdate = {
        status: trade.status,
        exitPrice: trade.exitPrice,
        exitBtcPrice: trade.exitBtcPrice,
        actualOutcome: trade.actualOutcome,
        pnl: trade.pnl,
        pctChange: trade.pctChange,
        closedAt: trade.closedAt
    };

    const doc = await TradeModel.findOneAndUpdate({ tradeId }, mongoUpdate, { new: true });
    if (doc) {
        console.log('✅ MongoDB update complete.');
    } else {
        console.error('❌ Trade not found in MongoDB!');
    }

    await redis.quit();
    await mongoose.disconnect();
    console.log('\n✨ Surgical resolution finished successfully.');
}

main().catch(err => {
    console.error('❌ Error during resolution:', err);
    process.exit(1);
});
