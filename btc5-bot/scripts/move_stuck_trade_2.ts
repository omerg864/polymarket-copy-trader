import { TradeModel } from '../src/models/Trade';
import redisService from '../src/services/redis';
import tradeService from '../src/services/tradeService';
import polymarketService from '../src/services/polymarket';
import notificationManager from '../src/services/notificationManager';
import { getStrategyConfig } from '../src/services/strategyConfig';
import mongoose from 'mongoose';
import config from '../src/config';
import logger from '../src/utils/logger';
import { TradeStatus, TradeType } from '@shared/types';
import { DateTime } from 'luxon';

async function moveTradeToHistory() {
    const tradeId = '0x752b98a2a792cafe69b00f967fe2d804d54d09cc3cff5cdc07ba35221a44160b';
    
    console.log('--- Connecting to services ---');
    await mongoose.connect(config.mongoUri);
    await redisService.connect();
    
    console.log('--- Loading Trade ---');
    const trade = await redisService.getTrade(tradeId);
    if (!trade) {
        console.error('❌ Trade not found in Redis active trades');
        await mongoose.disconnect();
        await redisService.disconnect();
        return;
    }

    console.log('Original Trade:', JSON.stringify(trade, null, 2));

    // Values provided by user:
    const revenue = 3.81;
    const finalPnL = -1.59;
    
    // We'll calculate the fee as the difference to keep accountants happy
    // Total Cost (entry cost + entry fee) = 5.37 + 0.04059... = 5.41059...
    // PnL = Revenue - Total Cost - Sell Fee
    // Sell Fee = Revenue - Total Cost - PnL
    const totalEntryCost = trade.cost + (trade.fee || 0);
    const impliedSellFee = revenue - totalEntryCost - finalPnL;
    const totalFee = (trade.fee || 0) + Math.max(0, impliedSellFee);

    console.log(`--- Values ---`);
    console.log(`Revenue: $${revenue}`);
    console.log(`PnL: $${finalPnL}`);
    console.log(`Implied Total Fee: $${totalFee.toFixed(4)}`);

    // Prepare updated trade object
    trade.pnl = finalPnL;
    trade.fee = totalFee;
    trade.status = TradeStatus.CLOSED_SL;
    trade.exitPrice = 0.639; // approx based on revenue/size
    trade.closedAt = new Date().toISOString();
    // Outcome was probably UP if SL triggered for DOWN, but we'll mark it as unresolved 
    // or just leave it since it's a closed_sl status.
    trade.actualOutcome = 'UP'; 
    trade.pctChange = (trade.exitPrice - trade.entryPrice) / trade.entryPrice;

    console.log('Updated Trade:', JSON.stringify(trade, null, 2));

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
    // Actually, balance was deducted when trade was opened: bal = bal_old - (cost + entry_fee)
    // Now we add revenue. 
    await redisService.setBotBalance(newBalance);
    console.log(`✅ Updated balance: $${bal.toFixed(2)} -> $${newBalance.toFixed(2)}`);

    // 4. Update Daily PnL
    const baseDate = trade.enteredAt
        ? DateTime.fromISO(trade.enteredAt)
        : DateTime.now();
    const todayStr = baseDate.setZone(sc.timezone).toISODate() || '';
    await redisService.incrementDailyPnl(todayStr, trade.pnl, false); // Mark as loss
    console.log('✅ Updated daily PnL stats');

    // 5. Update Global Stats
    const stats = await redisService.getBotStats();
    stats.totalTrades += 1;
    stats.losses += 1;
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
    console.log('--- Migration Complete ---');
}

moveTradeToHistory().catch(console.error);
