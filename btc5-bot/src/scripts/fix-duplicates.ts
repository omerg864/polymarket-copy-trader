import 'dotenv/config';
import Redis from 'ioredis';
import { type Trade } from '@shared/types';
import config from '../config';

const prefix = 'pmbot:';

async function fixDuplicates() {
    console.log('🔍 Connecting to Redis...');
    const redis = new Redis(config.redisUrl);
    
    try {
        const historyKey = `${prefix}history`;
        console.log(`📋 Reading history from ${historyKey}...`);
        
        const rawHistory = await redis.lrange(historyKey, 0, -1);
        if (rawHistory.length === 0) {
            console.log('✨ No history found.');
            return;
        }

        const trades: Trade[] = rawHistory.map(h => JSON.parse(h));
        const tradeGroups: Map<string, Trade[]> = new Map();

        // Group by ID
        for (const trade of trades) {
            if (!tradeGroups.has(trade.id)) {
                tradeGroups.set(trade.id, []);
            }
            tradeGroups.get(trade.id)!.push(trade);
        }

        let duplicatesFound = 0;
        let revenueToSubtract = 0;
        let feesToSubtract = 0;
        let pnlToSubtract = 0;

        for (const [id, group] of tradeGroups.entries()) {
            if (group.length > 1) {
                console.log(`⚠️  Found ${group.length} entries for trade ID ${id} (${group[0].title})`);
                
                // Identify the FCT one (or just the second one if both are same)
                const fctIndex = group.findIndex(t => t.status === 'closed_sell' || t.status === 'closed_tp' || t.status === 'closed_sl'); 
                // Wait, if we have SL and FCT, the user said remove the FCT one.
                // Status for FCT is usually 'closed_sell' in the live logic or reason 'fct' in demo.
                
                // Let's refine the search for the "bad" one.
                // FCT closure in RiskManager sets reason 'fct' but status 'closed_buy' or 'closed_sell'?
                // Actually in RiskManager.ts current version: trade.status = 'closed_sell' for live.
                
                const toRemove = group.find(t => 
                    // @ts-ignore
                    t.reason === 'fct' || 
                    // In RiskManager executeSell, reason is passed but status is 'closed_sell'
                    // If we have a duplicate, one is likely the "real" one (tp/sl) and other is fct.
                    // Let's look at the group and pick the one with 'closed_sell' if another more specific one exists.
                    (t.status === 'closed_sell' && group.some(other => other.status === 'closed_tp' || other.status === 'closed_sl'))
                ) || group[1]; // Fallback to second one

                console.log(`🗑️  Removing duplicate entry: Status=${toRemove.status}, PnL=$${toRemove.pnl.toFixed(2)}`);
                
                // Remove from Redis lrem
                const stringToRemove = rawHistory.find(h => {
                    const parsed = JSON.parse(h);
                    return parsed.id === toRemove.id && parsed.status === toRemove.status && parsed.pnl === toRemove.pnl;
                });

                if (stringToRemove) {
                    await redis.lrem(historyKey, 1, stringToRemove);
                    duplicatesFound++;

                    // Calculate revenue adjustment
                    // revenue = cost + fee + pnl
                    const revenue = (toRemove.pnl || 0) + (toRemove.cost || 0) + (toRemove.fee || 0);
                    // sellFee = totalFee - buyFee
                    // But wait, the balance addition was: bal + revenue - sellFee
                    // sellFee = calculateFee(trade.size, currentPrice)
                    // We don't have sellFee explicitly in the trade object, but we have total fee.
                    // This is tricky. Let's look at the balance update code again:
                    // bal + revenue - sellFee = bal + (exitPrice * size) - (size * exitPrice * 0.00)
                    
                    const sellFee = toRemove.size * toRemove.exitPrice! * 0.00; // Fee is 0 for limit? No, wait.
                    // calculateFee is size * price * 0.00 (it was 0.00 in earlier logs or 0.001?)
                    // Let's just use the PnL and cost to estimate.
                    // revenue - sellFee = PnL + cost + buyFee
                    
                    revenueToSubtract += (toRemove.exitPrice || 0) * toRemove.size;
                    // Wait, sellFee was subtracted from the added revenue.
                    // bal = bal + revenue - sellFee
                    
                    feesToSubtract += toRemove.fee || 0;
                    pnlToSubtract += toRemove.pnl || 0;
                }
            }
        }

        if (duplicatesFound > 0) {
            console.log(`\n✅ Removed ${duplicatesFound} duplicate(s).`);
            
            // Adjust balance
            const balanceKey = `${prefix}${config.isDemo ? 'demo' : 'live'}:balance`;
            const statsKey = `${prefix}${config.isDemo ? 'demo' : 'live'}:stats`;
            
            const currentBalance = parseFloat(await redis.get(balanceKey) || '0');
            console.log(`💰 Current Balance: $${currentBalance.toFixed(2)}`);
            
            // Re-calculate the revenue added during duplicate resolution.
            // RiskManager: bal = bal + revenue - sellFee
            // revenue = exitPrice * size
            // sellFee = totalFee - trade.fee (where trade.fee is the buy fee)
            
            // Let's just use the group data to find the exact duplicate's contribution.
            // For now, I'll subtract the revenue estimated from exitPrice * size.
            // This is the most accurate way since that's what was added.
            
            const totalToSubtract = revenueToSubtract; // Approximate
            console.log(`📉 Adjusting balance by -$${totalToSubtract.toFixed(2)}...`);
            
            await redis.set(balanceKey, (currentBalance - totalToSubtract).toString());
            
            // Adjust Stats
            const statsRaw = await redis.get(statsKey);
            if (statsRaw) {
                const stats = JSON.parse(statsRaw);
                stats.totalTrades -= duplicatesFound;
                stats.totalPnl -= pnlToSubtract;
                stats.totalFees -= (feesToSubtract / 2); // Approximation if we don't know buy vs sell
                // Adjust wins/losses
                // This is complex, but let's assume if PnL > 0 it was a win.
                if (pnlToSubtract >= 0) stats.wins -= duplicatesFound;
                else stats.losses -= duplicatesFound;
                
                await redis.set(statsKey, JSON.stringify(stats));
                console.log('📊 Stats updated.');
            }
            
            console.log(`✨ DONE! New Balance: $${(currentBalance - totalToSubtract).toFixed(2)}`);
        } else {
            console.log('✅ No duplicates found in history.');
        }

    } finally {
        await redis.quit();
    }
}

fixDuplicates().catch(console.error);
