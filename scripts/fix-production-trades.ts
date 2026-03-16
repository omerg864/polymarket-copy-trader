/**
 * Fix specific trades that were incorrectly stopped out due to price-fetching bugs.
 * Usage: npx tsx scripts/fix-production-trades.ts
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Redis from 'ioredis';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
	path: path.resolve(__dirname, '..', 'btc5-bot', '.env.production.local'),
});

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const PREFIX = 'pmbot:';
const MODE = process.env.MODE || 'production';

const TARGET_TRADE_IDS = [
	'fcbaa68c-c826-4d25-b691-2b26042861e9',
	'1c1dc021-2f8f-4480-9844-5cdaabc82af6',
];

const GAMMA_API = 'https://gamma-api.polymarket.com';

async function getMarketOutcome(slug: string): Promise<string | null> {
	try {
		const response = await axios.get(`${GAMMA_API}/events`, {
			params: { slug },
		});
		const events = response.data;
		if (!Array.isArray(events) || events.length === 0) return null;

		const event = events.find((e: any) => e.ticker === slug || e.slug === slug);
		if (!event) return null;

		const marketData = event.markets?.[0];
		if (!marketData || !marketData.closed) return null;

		const prices: string[] = JSON.parse(marketData.outcomePrices);
		const outcomes: string[] = JSON.parse(marketData.outcomes);

		for (let i = 0; i < prices.length; i++) {
			if (parseFloat(prices[i]) === 1) {
				return outcomes[i]?.toUpperCase();
			}
		}
		return null;
	} catch (error) {
		console.error(`Error fetching outcome for ${slug}:`, error);
		return null;
	}
}

async function main() {
	const redis = new Redis(REDIS_URL);
	console.log(`Connected to Redis for recovery (MODE: ${MODE})\n`);

	const historyKey = `${PREFIX}${MODE}:history`;
	const history = await redis.lrange(historyKey, 0, -1);
	
	for (const id of TARGET_TRADE_IDS) {
		console.log(`Checking trade ${id}...`);
		const tradeIndex = history.findIndex(raw => JSON.parse(raw).id === id);
		
		if (tradeIndex === -1) {
			console.warn(`  ⚠️  Trade ${id} not found in history.`);
			continue;
		}

		const trade = JSON.parse(history[tradeIndex]);
		console.log(`  Found trade: ${trade.direction} on ${trade.slug} (Status: ${trade.status})`);

		if (trade.status !== 'closed_sl') {
			console.log(`  Skipping: trade is already ${trade.status}`);
			continue;
		}

		// Verify outcome
		const outcome = await getMarketOutcome(trade.slug);
		if (!outcome) {
			console.warn(`  ⚠️  Could not verify outcome for market ${trade.slug}. Skipping.`);
			continue;
		}

		if (outcome === trade.direction) {
			console.log(`  ✅ Verified WIN! Outcome ${outcome} matches direction ${trade.direction}.`);
			
			// Recover trade
			const recoveredTrade = {
				...trade,
				status: 'closed_resolved',
				exitPrice: 1.0,
				pnl: trade.size - trade.cost - (trade.fee || 0),
				notes: (trade.notes || '') + ' [RECOVERED: Fixed incorrect SL due to price bug]',
			};

			await redis.lset(historyKey, tradeIndex, JSON.stringify(recoveredTrade));
			console.log(`  🚀 Trade ${id} RECOVERED in history.`);
		} else {
			console.log(`  ❌ Resolution was ${outcome}. Trade was actually a loss. Leaving as is.`);
		}
	}

	console.log('\nRecovery complete. Please run verify-stats to update stats and balance.');
	await redis.quit();
}

main().catch(console.error);
