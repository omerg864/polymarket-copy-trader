import { Trade, TradeType } from '../../../shared/src/types';
import config from '../config';
import { TradeModel } from '../models/Trade';

class TradeService {
	async getTradeHistory(limit?: number): Promise<Trade[]> {
		try {
			let query = TradeModel.find({ type: config.mode }).sort({
				closedAt: -1,
			});

			if (limit) {
				query = query.limit(limit);
			}

			const docs = await query;

			return docs.map((doc) => {
				const { tradeId: id, _id, __v, ...obj } = doc.toObject() as any;
				return { ...obj, id } as Trade;
			});
		} catch (err) {
			console.error(`Failed to fetch trade history from MongoDB: ${err}`);
			return [];
		}
	}

	async clearAllTrades(type: TradeType): Promise<void> {
		try {
			await TradeModel.deleteMany({ type });
			console.log(`Cleared all ${type} trades from MongoDB`);
		} catch (err) {
			console.error(`Failed to clear trades from MongoDB: ${err}`);
			throw err;
		}
	}

	async getMongoStats(): Promise<{
		totalTrades: number;
		storageSize: string;
		storageSizeInBytes: number;
	}> {
		try {
			const totalTrades = await TradeModel.countDocuments();
			const stats = await TradeModel.db.db!.stats();
			const storageSizeMB = (stats.storageSize / (1024 * 1024)).toFixed(
				2,
			);

			return {
				totalTrades,
				storageSize: `${storageSizeMB} MB`,
				storageSizeInBytes: stats.storageSize,
			};
		} catch (err) {
			console.error(`Failed to fetch MongoDB stats: ${err}`);
			return {
				totalTrades: 0,
				storageSize: '0 MB',
				storageSizeInBytes: 0,
			};
		}
	}
}

export const tradeService = new TradeService();
export default tradeService;
