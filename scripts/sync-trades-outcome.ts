/**
 * Market Outcome Sync Script
 * Populates actualOutcome field for all historical trades.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Redis from 'ioredis';
import axios from 'axios';
import { TradeType, type Trade } from '../shared/src/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', 'btc5-bot', '.env') });

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const GAMMA_API = 'https://gamma-api.polymarket.com';
const PREFIX = 'pmbot:';

const redis = new Redis(REDIS_URL);

async function getMarketOutcome(slug: string): Promise<string | null> {
	try {
		const response = await axios.get(`${GAMMA_API}/events`, {
			params: { slug },
			timeout: 5000,
		});

		const events = response.data;
		if (!Array.isArray(events) || events.length === 0) return null;

		const event = events.find(
			(e: any) => e.ticker === slug || e.slug === slug,
		);
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
		return null;
	}
}

async function main() {
	console.log('🔗 Connected to Redis');

	for (const mode of Object.values(TradeType)) {
		console.log(`\n🚀 Syncing ${mode.toUpperCase()} trades...`);
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

			// Skip if already has an outcome and it's not UNKNOWN
			if (trade.actualOutcome && trade.actualOutcome !== 'UNKNOWN') {
				updatedTrades.push(JSON.stringify(trade));
				continue;
			}

			let outcome: 'UP' | 'DOWN' | 'UNKNOWN' = 'UNKNOWN';

			// Inferred outcome for won/lost trades
			if (trade.status === 'won') {
				outcome = trade.direction as 'UP' | 'DOWN';
			} else if (trade.status === 'lost') {
				outcome = trade.direction === 'UP' ? 'DOWN' : 'UP';
			}

			// If still unknown (e.g. stopped out, or just unresolved), fetch from Polymarket
			if (outcome === 'UNKNOWN' && trade.eventTicker) {
				console.log(
					`🔍 Fetching Polymarket outcome for: ${trade.title} (${trade.eventTicker})`,
				);
				const winner = await getMarketOutcome(trade.eventTicker);
				if (winner === 'UP' || winner === 'DOWN') {
					outcome = winner;
					console.log(`✅ Found: ${winner}`);
				} else {
					console.log(`❌ Still unsettled or not found.`);
				}
			}

			if (outcome !== 'UNKNOWN') {
				trade.actualOutcome = outcome;
				updatedCount++;
			} else {
				trade.actualOutcome = 'UNKNOWN';
			}

			updatedTrades.push(JSON.stringify(trade));
		}

		if (updatedCount > 0) {
			console.log(
				`💾 Saving ${updatedCount} updated trades to Redis for ${mode}...`,
			);
			// We use a transaction or just del + rpush
			const pipeline = redis.pipeline();
			pipeline.del(historyKey);
			pipeline.rpush(historyKey, ...updatedTrades);
			await pipeline.exec();
		} else {
			console.log(`✅ All ${mode} trades already have outcomes.`);
		}
	}

	console.log('\n✨ Sync completed successfully!');
	await redis.quit();
}

main().catch((err) => {
	console.error('❌ Sync failed:', err);
	process.exit(1);
});
