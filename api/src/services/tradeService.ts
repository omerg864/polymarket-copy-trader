import { type Trade } from '../../../shared/src/index';
import config from '../config';
import { TradeModel } from '../models/Trade';

class TradeService {
	async getTradeHistory(limit?: number): Promise<Trade[]> {
		try {
			const isDemo = config.isDemo;
			let query = TradeModel.find({ type: isDemo ? 'demo' : 'live' }).sort({
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
}

export const tradeService = new TradeService();
export default tradeService;
