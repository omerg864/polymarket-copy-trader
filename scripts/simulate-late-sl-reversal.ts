import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { DateTime } from 'luxon';

// Setup paths
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
	path: path.resolve(__dirname, '..', 'btc5-bot', '.env.production.local'),
});

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/polymarket-bot';
const modeArg = process.argv.find(arg => arg.startsWith('--mode='));
const MODE = modeArg ? modeArg.split('=')[1] : (process.env.MODE || 'demo');

async function main() {
    console.log(`Connecting to MongoDB for ${MODE} mode simulation...`);
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;
    const tradesCollection = db.collection('trades');

    console.log('Fetching trades from database...');
    const allTrades = await tradesCollection.find({ type: MODE }).toArray();
    console.log(`Found ${allTrades.length} trades.`);

    const lateSlTrades: any[] = [];
    let totalOriginalPnl = 0;
    let totalSimulatedPnl = 0;
    let totalTrades = 0;

    const dailyStats: Record<string, {
        originalPnl: number;
        simulatedPnl: number;
        tradeCount: number;
        affectedCount: number;
        winsConverted: number;
        lossesConverted: number;
    }> = {};

    for (const t of allTrades) {
        const originalPnl = t.pnl || 0;
        let simPnl = originalPnl;
        let isAffected = false;
        let conversionType: 'NONE' | 'SL_TO_WIN' | 'SL_TO_LOSS' = 'NONE';

        const startTime = DateTime.fromISO(t.startTime);
        const endTime = DateTime.fromISO(t.endTime);
        const closedAt = t.closedAt ? DateTime.fromISO(t.closedAt) : null;
        
        const dateKey = startTime.toISODate() || 'unknown';
        if (!dailyStats[dateKey]) {
            dailyStats[dateKey] = {
                originalPnl: 0,
                simulatedPnl: 0,
                tradeCount: 0,
                affectedCount: 0,
                winsConverted: 0,
                lossesConverted: 0
            };
        }

        // Check if trade was closed by SL within 4 seconds of market close
        if (t.status === 'closed_sl' && closedAt && endTime.diff(closedAt).as('seconds') < 4) {
            isAffected = true;
            
            if (t.actualOutcome && t.actualOutcome !== 'UNKNOWN') {
                const cost = t.cost || 0;
                const entryPrice = t.entryPrice || 0;
                
                if (t.actualOutcome === t.direction) {
                    // Win simulation: (1/entryPrice - 1) * cost (No fees)
                    simPnl = (1 / entryPrice - 1) * cost;
                    conversionType = 'SL_TO_WIN';
                    dailyStats[dateKey].winsConverted++;
                } else {
                    // Loss simulation: -cost (No fees)
                    simPnl = -cost;
                    conversionType = 'SL_TO_LOSS';
                    dailyStats[dateKey].lossesConverted++;
                }
            }
            
            lateSlTrades.push({
                id: t.tradeId,
                direction: t.direction,
                outcome: t.actualOutcome,
                entry: t.entryPrice,
                closedAt: t.closedAt,
                endTime: t.endTime,
                diffSec: endTime.diff(closedAt).as('seconds').toFixed(2),
                originalPnl: originalPnl.toFixed(4),
                simPnl: simPnl.toFixed(4),
                delta: (simPnl - originalPnl).toFixed(4),
                type: conversionType
            });
            
            dailyStats[dateKey].affectedCount++;
        }

        dailyStats[dateKey].originalPnl += originalPnl;
        dailyStats[dateKey].simulatedPnl += simPnl;
        dailyStats[dateKey].tradeCount++;

        totalOriginalPnl += originalPnl;
        totalSimulatedPnl += simPnl;
        totalTrades++;
    }

    // --- REPORTING ---
    console.log('\n' + '='.repeat(100));
    console.log('LATE STOP-LOSS SIMULATION REPORT (< 4 SECONDS BEFORE CLOSE)');
    console.log('='.repeat(100));

    if (lateSlTrades.length === 0) {
        console.log('No trades found that hit SL within 4 seconds of market close.');
    } else {
        console.log('\nINDIVIDUAL AFFECTED TRADES:');
        console.log('ID'.padEnd(10) + ' | ' + 'Dir'.padEnd(5) + ' | ' + 'Outcome'.padEnd(8) + ' | ' + 'Entry'.padEnd(8) + ' | ' + 'DiffSec'.padEnd(10) + ' | ' + 'Orig PnL'.padEnd(12) + ' | ' + 'Sim PnL'.padEnd(12) + ' | ' + 'Delta'.padEnd(12) + ' | ' + 'Conversion');
        console.log('-'.repeat(120));
        
        for (const t of lateSlTrades) {
            console.log(
                `${t.id.substring(0, 8).padEnd(10)} | ` +
                `${t.direction.padEnd(5)} | ` +
                `${(t.outcome || '???').padEnd(8)} | ` +
                `${t.entry.toFixed(3).padEnd(8)} | ` +
                `${t.diffSec.padEnd(10)} | ` +
                `${t.originalPnl.padStart(12)} | ` +
                `${t.simPnl.padStart(12)} | ` +
                `${t.delta.padStart(12)} | ` +
                `${t.type}`
            );
        }
    }

    console.log('\nDAILY SUMMARY:');
    console.log('Date'.padEnd(12) + ' | ' + 'Trades'.padEnd(8) + ' | ' + 'Affected'.padEnd(10) + ' | ' + 'W Conv'.padEnd(8) + ' | ' + 'L Conv'.padEnd(8) + ' | ' + 'Orig PnL'.padEnd(15) + ' | ' + 'Sim PnL'.padEnd(15) + ' | ' + 'Delta');
    console.log('-'.repeat(120));

    const sortedDates = Object.keys(dailyStats).sort();
    for (const date of sortedDates) {
        const s = dailyStats[date];
        const delta = s.simulatedPnl - s.originalPnl;
        console.log(
            `${date.padEnd(12)} | ` +
            `${s.tradeCount.toString().padEnd(8)} | ` +
            `${s.affectedCount.toString().padEnd(10)} | ` +
            `${s.winsConverted.toString().padEnd(8)} | ` +
            `${s.lossesConverted.toString().padEnd(8)} | ` +
            `${s.originalPnl.toFixed(2).padStart(15)} | ` +
            `${s.simulatedPnl.toFixed(2).padStart(15)} | ` +
            `${delta.toFixed(2).padStart(10)}`
        );
    }

    console.log('\n' + '='.repeat(100));
    console.log(`TOTAL TRADES ANALYZED:  ${totalTrades}`);
    console.log(`TOTAL AFFECTED TRADES:  ${lateSlTrades.length}`);
    console.log(`TOTAL ORIGINAL PNL:     $${totalOriginalPnl.toFixed(2)}`);
    console.log(`TOTAL SIMULATED PNL:    $${totalSimulatedPnl.toFixed(2)}`);
    console.log(`TOTAL PNL DELTA:        $${(totalSimulatedPnl - totalOriginalPnl).toFixed(2)}`);
    console.log('='.repeat(100));

    await mongoose.disconnect();
    console.log('\nDone.');
}

main().catch(console.error);
