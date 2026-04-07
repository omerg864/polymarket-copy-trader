/**
 * Manually resolve the 4 identified stuck demo trades.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Redis from 'ioredis';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load production environment
dotenv.config({
	path: path.resolve(__dirname, '..', 'btc5-bot', '.env.production.local'),
});

const REDIS_URL = process.env.REDIS_URL;
const PREFIX = 'pmbot:';
const MODE = 'demo';

const STUCK_TRADE_IDS = [
	'7bf27fc0-3dba-4379-91ce-fe7a6c6772f1',
	'd2f1e6e1-57be-4c43-8201-e381de1554a0',
	'5dff553b-c4f4-498b-bd9c-e6fe408f3861',
	'2364a800-0713-4908-93c5-768d0b1ca9e5',
];

async function getHistoricalPrice(endTimeStr: string): Promise<number | null> {
	const endTimeMs = new Date(endTimeStr).getTime();
	try {
		// Fetch 1m kline starting at the end time
		const url = `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&startTime=${endTimeMs}&limit=1`;
		const response = await axios.get(url);
		if (response.data && response.data.length > 0) {
			// [startTime, open, high, low, close, volume, endTime, ...]
            // We use the 'open' of the minute starting at endTime as the resolution price
			return parseFloat(response.data[0][1]);
		}
	} catch (err) {
		console.error(`Error fetching price for ${endTimeStr}:`, err);
	}
	return null;
}

async function main() {
	if (!REDIS_URL) {
		console.error('❌ REDIS_URL not found');
		process.exit(1);
	}

	const redis = new Redis(REDIS_URL);
	console.log('Connected to Redis.');

	for (const id of STUCK_TRADE_IDS) {
		const tradeKey = `${PREFIX}${MODE}:trade:${id}`;
		const rawTrade = await redis.get(tradeKey);

		if (!rawTrade) {
			console.log(`⚠️  Trade ${id} not found. Skipping.`);
			continue;
		}

		const trade = JSON.parse(rawTrade);
		console.log(`\nProcessing: ${trade.title} (${id})`);

		const resolutionPrice = await getHistoricalPrice(trade.endTime);
		if (!resolutionPrice) {
			console.log(`❌ Could not get resolution price for ${trade.endTime}. Skipping.`);
			continue;
		}

		console.log(`  End Price (BTC): ${resolutionPrice}`);
		console.log(`  Ref Price (BTC): ${trade.priceToBeat}`);
		console.log(`  Direction:       ${trade.direction}`);

		const actualOutcome = resolutionPrice > trade.priceToBeat ? 'UP' : 'DOWN';
		const isWin = actualOutcome === trade.direction;

		trade.status = isWin ? 'won' : 'lost';
		trade.exitPrice = isWin ? 1.0 : 0.0;
		trade.exitBtcPrice = resolutionPrice;
		trade.closedAt = new Date().toISOString();
		
        const revenue = isWin ? (1.0 * trade.size) : 0;
        const fee = trade.fee || 0;
		trade.pnl = revenue - trade.cost - fee;
		trade.pctChange = (trade.exitPrice - trade.entryPrice) / trade.entryPrice;

		console.log(`  Result: ${trade.status.toUpperCase()} (Outcome: ${actualOutcome})`);
		console.log(`  PnL:    $${trade.pnl.toFixed(2)}`);

		// 1. Remove from active
		await redis.srem(`${PREFIX}${MODE}:active_trades`, id);
		await redis.del(tradeKey);

		// 2. Add to history
		await redis.lpush(`${PREFIX}${MODE}:history`, JSON.stringify(trade));
		await redis.sadd(`${PREFIX}${MODE}:history_ids`, id);

		// 3. Update stats
		const statsKey = `${PREFIX}${MODE}:stats`;
		const rawStats = await redis.get(statsKey);
		if (rawStats) {
			const stats = JSON.parse(rawStats);
			stats.totalTrades += 1;
			if (isWin) stats.wins += 1;
			else stats.losses += 1;
			stats.totalPnl += trade.pnl;
			stats.totalFees += fee;
			stats.lastUpdated = new Date().toISOString();
			await redis.set(statsKey, JSON.stringify(stats));
			console.log(`  Stats Updated.`);
		}

		// 4. Update Balance
		const balKey = `${PREFIX}${MODE}:balance`;
		const rawBal = await redis.get(balKey);
		if (rawBal) {
			const bal = parseFloat(rawBal);
			const newBal = bal + revenue;
			await redis.set(balKey, newBal.toString());
			console.log(`  Balance Updated: $${newBal.toFixed(2)}`);
		}
        
        // 5. Update daily stats if possible (standard pattern)
        const todayStr = new Date().toISOString().split('T')[0];
        const dailyPnlKey = `${PREFIX}${MODE}:daily_pnl:${todayStr}`;
        // This is a hash in this project usually
        await redis.hincrbyfloat(dailyPnlKey, 'pnl', trade.pnl);
        await redis.hincrby(dailyPnlKey, 'totalTrades', 1);
        if (isWin) await redis.hincrby(dailyPnlKey, 'wins', 1);
        else await redis.hincrby(dailyPnlKey, 'losses', 1);

		console.log(`✅ Trade ${id} resolved.`);
	}

	await redis.quit();
	console.log('\n🏁 All done.');
}

main().catch(console.error);
