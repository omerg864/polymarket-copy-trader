import axios from 'axios';
import config from '../config';
import logger from '../utils/logger';

export interface ClobTrade {
	id: string; // The Data API might not have a dedicated 'id', we can use transactionHash
	proxyWallet: string;
	price: number;
	size: number;
	side: 'BUY' | 'SELL';
	asset: string; // This is the token ID
	timestamp: number;
	conditionId: string;
    transactionHash: string;
    title: string;
}

class CopyTraderService {
	private dataApi = axios.create({
		baseURL: 'https://data-api.polymarket.com',
		timeout: 10000,
	});

	async getWalletTrades(address: string): Promise<ClobTrade[]> {
		try {
			const response = await this.dataApi.get<any[]>('/activity', {
				params: {
					user: address,
                    type: 'TRADE',
                    limit: 20
				},
			});
            
            // Map Data API response to our ClobTrade interface
			return (response.data || []).map(item => ({
                id: item.transactionHash,
                proxyWallet: item.proxyWallet,
                price: item.price,
                size: item.size,
                side: item.side,
                asset: item.asset,
                timestamp: item.timestamp,
                conditionId: item.conditionId,
                transactionHash: item.transactionHash,
                title: item.title
            }));
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			logger.error(`Error fetching trades for wallet ${address}: ${message}`);
			return [];
		}
	}
}

export const copyTraderService = new CopyTraderService();
export default copyTraderService;
