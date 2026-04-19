import redisService from '../src/services/redis';
import tradeService from '../src/services/tradeService';
import notificationManager from '../src/services/notificationManager';
import { getStrategyConfig } from '../src/services/strategyConfig';
import mongoose from 'mongoose';
import config from '../src/config';
import { TradeStatus } from '@shared/types';
import { DateTime } from 'luxon';

async function resolveStuckTrade() {
    const tradeId = '0x2a02d4d7347cf44bb0df14107c19f1d81ef8e42b5777fc31e4c4a33ca4af94c8';
    
    console.log('--- Connecting to services ---');
    await mongoose.connect(config.mongoUri);
    await redisService.connect();
    
    console.log(`--- Loading Trade ${tradeId} ---`);
    const trade = await redisService.getTrade(tradeId);
    if (!trade) {
        console.error('❌ Trade not found in Redis active trades');
        await mongoose.disconnect();
        await redisService.disconnect();
        return;
    }

    console.log('Original Trade:', JSON.stringify(trade, null, 2));

    const revenue = 6.0;
    const finalPrice = 1.0;
    const totalFee = trade.fee || 0;
    const finalPnL = revenue - trade.cost - totalFee;
    
    console.log(`--- Values ---`);
    console.log(`Revenue: $${revenue}`);
    console.log(`PnL: $${finalPnL.toFixed(2)}`);
    console.log(`Fees: $${totalFee.toFixed(4)}`);

    // Prepare updated trade object
    trade.pnl = finalPnL;
    trade.status = TradeStatus.WON;
    trade.exitPrice = finalPrice;
    trade.closedAt = new Date().toISOString();
    trade.actualOutcome = 'UP'; 
    trade.pctChange = trade.entryPrice > 0 ? (trade.exitPrice - trade.entryPrice) / trade.entryPrice : 0;

    console.log('Updated Trade Data Ready');

    // 1. Remove from active trades
    console.log('--- Updating state ---');
    await redisService.removeTrade(tradeId);
    console.log('✅ Removed from Redis active trades');

    // 2. Save to history (MongoDB + Redis SET)
    await tradeService.saveTradeHistory(trade);
    console.log('✅ Saved to MongoDB and Redis history IDs');

    // 3. Update Balance
    const sc = await getStrategyConfig();
    const bal = await redisService.getBotBalance(sc);
    const newBalance = bal + revenue; // Bot already deducted full cost + entry fee when opening
    await redisService.setBotBalance(newBalance);
    console.log(`✅ Updated balance: $${bal.toFixed(2)} -> $${newBalance.toFixed(2)}`);

    // 4. Update Daily PnL
    const baseDate = trade.enteredAt
        ? DateTime.fromISO(trade.enteredAt)
        : DateTime.now();
    const todayStr = baseDate.setZone(sc.timezone).toISODate() || '';
    await redisService.incrementDailyPnl(todayStr, trade.pnl, true); // Mark as win
    console.log(`✅ Updated daily PnL stats for ${todayStr}`);

    // 5. Update Global Stats
    const stats = await redisService.getBotStats();
    stats.totalTrades += 1;
    stats.wins += 1;
    stats.totalPnl += trade.pnl;
    stats.totalFees += totalFee;
    await redisService.updateBotStats(stats);
    console.log('✅ Updated global bot stats');

    // 6. Notify
    try {
        await notificationManager.handleTradeClosed(trade, stats, newBalance);
        console.log('✅ Notification sent');
    } catch (e) {
        console.warn('⚠️ Notification failed:', e);
    }

    await mongoose.disconnect();
    await redisService.disconnect();
    console.log('--- Manual Resolution Complete ---');
}

resolveStuckTrade().catch(console.error);
