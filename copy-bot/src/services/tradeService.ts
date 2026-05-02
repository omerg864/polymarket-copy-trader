import { DEFAULT_STRATEGY_CONFIG, REDIS_KEYS, type Trade } from '@shared/index';
import config from '../config';
import { TradeModel } from '../models/Trade';
import logger from '../utils/logger';
import redisService from './redis';

class TradeService {
	private readonly mode = config.mode;

	async saveTradeHistory(trade: Trade): Promise<Trade> {
		const record: Trade = {
			...trade,
			closedAt: trade.closedAt || new Date().toISOString(),
		};

		try {
			// 1. Save to MongoDB
			await TradeModel.updateOne(
				{ tradeId: trade.id },
				{ $set: { ...record, tradeId: trade.id } },
				{ upsert: true },
			);

			// 2. Add ID to Redis SET for fast presence checks
			await redisService.addToHistoryIds(trade.id);

			logger.info(`Trade ${trade.id} saved to MongoDB history and Redis SET`);
		} catch (err) {
			logger.error(`Failed to save trade ${trade.id} to history: ${err}`);
		}

		return record;
	}

	async getTradeHistory(limit?: number): Promise<Trade[]> {
		try {
			const query = TradeModel.find({ type: this.mode }).sort({ closedAt: -1 });
			if (limit) {
				query.limit(limit);
			}
			const docs = await query;

			return docs.map((doc) => {
				const { tradeId: id, _id, __v, ...obj } = doc.toObject() as any;
				return { ...obj, id } as Trade;
			});
		} catch (err) {
			logger.error(`Failed to fetch trade history from MongoDB: ${err}`);
			return [];
		}
	}

	async updateTradeInHistory(trade: Partial<Trade> & { id: string }): Promise<void> {
		try {
			await TradeModel.updateOne(
				{ tradeId: trade.id },
				{ $set: { ...trade, tradeId: trade.id } },
			);
			// Also ensure it's in history IDs (redundant but safe)
			await redisService.addToHistoryIds(trade.id);
		} catch (err) {
			logger.error(`Failed to update trade ${trade.id} in MongoDB: ${err}`);
		}
	}

	/**
	 * Synchronizes all trade IDs from MongoDB to the Redis SET.
	 * Used on bot startup to ensure Redis stay in sync with historical records.
	 */
	async syncHistoryIds(): Promise<void> {
		try {
			logger.info('🔄 Synchronizing history IDs from MongoDB to Redis...');
			// 1. Calculate limit (10 * maxConcurrentTrades)
			let maxConcurrent = DEFAULT_STRATEGY_CONFIG.maxConcurrentTrades;
			try {
				const rawConfig = await redisService.getRaw(REDIS_KEYS.STRATEGY_CONFIG(this.mode));
				if (rawConfig) {
					const config = JSON.parse(rawConfig);
					if (config && typeof config === 'object' && config.maxConcurrentTrades) {
						maxConcurrent = config.maxConcurrentTrades;
					}
				}
			} catch (err) {
				// Fallback to default
			}
			const limit = maxConcurrent * 10;

			// 2. Fetch only the last N trades for efficiency
			const trades = await TradeModel.find({ type: this.mode }, 'tradeId')
				.sort({ closedAt: -1 })
				.limit(limit);
			
			if (trades.length === 0) {
				logger.info('✅ No historical trades found in MongoDB to sync.');
				return;
			}

			// 3. Add IDs to Redis ZSET
			// Reverse to add oldest first (lower rank) and newest last (higher rank)
			const reversedTrades = [...trades].reverse();
			for (const trade of reversedTrades) {
				await redisService.addToHistoryIds(trade.tradeId);
			}

			logger.info(`✅ Successfully synchronized ${trades.length} history IDs to Redis (Limited to last ${limit}).`);
		} catch (err) {
			logger.error(`Failed to sync history IDs: ${err}`);
		}
	}
}

export const tradeService = new TradeService();
export default tradeService;
