import { Wallet } from '@ethersproject/wallet';
import { ClobClient, OrderType, Side } from '@polymarket/clob-client';
import type { Market, MarketPrices } from '@shared/types';
import axios, { AxiosInstance } from 'axios';
import { ethers } from 'ethers';
import config, { validateLiveConfig } from '../config';
import logger from '../utils/logger';
import NotificationManager from './notificationManager';
import { getStrategyConfig } from './strategyConfig';
import * as async from 'async';

interface OrderBook {
	midpoint?: string;
	bids?: Array<{ price: string; size: string }>;
	asks?: Array<{ price: string; size: string }>;
}

interface GammaMarket {
	id: string;
	question: string;
	conditionId: string;
	slug: string;
	resolutionSource: string;
	endDate: string;
	eventStartTime?: string;
	closed: boolean;
	clobTokenIds: string; // JSON string
	orderPriceMinTickSize?: number;
	negRisk?: boolean;
	orderMinSize?: number;
	outcomePrices: string; // JSON string
	outcomes: string; // JSON string
	groupItemThreshold?: string;
	questionID: string;
}

interface GammaEvent {
	id: string;
	ticker: string;
	slug: string;
	title: string;
	description: string;
	startDate: string;
	endDate: string;
	active: boolean;
	closed: boolean;
	markets: GammaMarket[];
}

interface CryptoPriceResponse {
	openPrice: number;
	closePrice: number | null;
	timestamp: number;
	completed: boolean;
	incomplete: boolean;
	cached: boolean;
}

class PolymarketService {
	private clobClient: ClobClient | null = null;
	private gammaApi: AxiosInstance;
	private signer: Wallet | null = null;

	constructor() {
		this.gammaApi = axios.create({
			baseURL: config.gammaHost,
			timeout: 10000,
		});
	}

	async initialize(): Promise<void> {
		if (config.isDemo) {
			logger.info(
				'🎮 Polymarket service initialized in DEMO mode (read-only CLOB prices)',
			);
			this.clobClient = new ClobClient(config.clobHost, config.chainId);
			return;
		}

		validateLiveConfig();

		this.signer = new Wallet(config.privateKey);
		const creds = await new ClobClient(
			config.clobHost,
			config.chainId,
			this.signer,
		).createOrDeriveApiKey();

		this.clobClient = new ClobClient(
			config.clobHost,
			config.chainId,
			this.signer,
			creds,
			config.signatureType,
			config.funderAddress,
		);

		logger.info('✅ Polymarket CLOB client initialized for LIVE trading');
	}

	async getPriceToBeat(
		symbol: string,
		eventStartTime: string | Date,
		endDate: string | Date,
	): Promise<number | null> {
		try {
			const startStr =
				typeof eventStartTime === 'string'
					? eventStartTime
					: eventStartTime.toISOString();
			const endStr =
				typeof endDate === 'string' ? endDate : endDate.toISOString();

			const url = `${config.mainHost}/api/crypto/crypto-price`;
			const response = await axios.get<CryptoPriceResponse>(url, {
				params: {
					symbol,
					eventStartTime: startStr,
					variant: 'fiveminute',
					endDate: endStr,
				},
				timeout: 5000,
			});

			if (response.data && typeof response.data.openPrice === 'number') {
				return response.data.openPrice;
			}
			return null;
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			logger.warn(
				`Failed to fetch priceToBeat from Polymarket: ${message}`,
			);
			return null;
		}
	}

	// ---- Market Discovery ----

	private _getMarketSlug(epochSeconds: number): string {
		return `btc-updown-5m-${epochSeconds}`;
	}

	private _getCurrentFiveMinBoundary(date: Date = new Date()): number {
		const epoch = Math.floor(date.getTime() / 1000);
		const fiveMin = 300;
		return Math.floor(epoch / fiveMin) * fiveMin;
	}

	async getNextMarket(): Promise<Market | null> {
		try {
			const now = new Date();
			const currentStart = this._getCurrentFiveMinBoundary(now);
			const nextStart = currentStart + 300;

			// 1. Try to get the CURRENT active market first
			let market = await this._fetchMarketBySlug(
				this._getMarketSlug(currentStart),
			);

			// If current market is found, check if it's still actionable
			if (market) {
				const sc = await getStrategyConfig();
				const minMsRemaining = sc.minSecondsRemaining * 1000;
				const msUntilEnd = market.endTime.getTime() - now.getTime();

				// Return current market if it has enough time
				if (msUntilEnd >= minMsRemaining) {
					return market;
				}
			}

			// 2. If current market is almost over or missing, get the NEXT market
			market = await this._fetchMarketBySlug(
				this._getMarketSlug(nextStart),
			);
			if (market) return market;

			logger.warn(
				'No active BTC 5-minute markets found for current or upcoming window',
			);
			return null;
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			logger.error(`Error fetching next market: ${message}`);
			NotificationManager.handleError(
				error,
				'Polymarket',
				'getNextMarket',
			);
			return null;
		}
	}

	async getMarketOutcome(slug: string): Promise<string | null> {
		try {
			const response = await this.gammaApi.get<GammaEvent[]>('/events', {
				params: { slug },
			});

			const events = response.data;
			if (!Array.isArray(events) || events.length === 0) return null;

			const event = events.find(
				(e) => e.ticker === slug || e.slug === slug,
			);
			if (!event) return null;

			const marketData = event.markets?.[0];
			if (!marketData || !marketData.closed) return null;

			const prices: string[] = JSON.parse(marketData.outcomePrices);
			const outcomes: string[] = JSON.parse(marketData.outcomes);

			for (let i = 0; i < prices.length; i++) {
				if (parseFloat(prices[i]) === 1) {
					const winner = outcomes[i]?.toUpperCase();
					logger.info(
						`📋 Market resolved: ${winner} won (${event.title})`,
					);
					return winner;
				}
			}

			logger.debug(`Market closed but no winner yet: ${slug}`);
			return null;
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			logger.debug(`Error fetching market outcome: ${message}`);
			return null;
		}
	}

	private async _fetchMarketBySlug(slug: string): Promise<Market | null> {
		try {
			const response = await this.gammaApi.get<GammaEvent[]>('/events', {
				params: { slug },
			});

			const events = response.data;
			if (!Array.isArray(events) || events.length === 0) return null;

			const event = events.find(
				(e) => e.ticker === slug || e.slug === slug,
			);
			if (!event) return null;

			const marketData = event.markets?.[0];
			if (!marketData || marketData.closed) return null;

			const endDate = new Date(marketData.endDate);
			const now = new Date();
			if (endDate <= now) return null;

			const tokenIds: string[] = JSON.parse(marketData.clobTokenIds);

			// Fetch priceToBeat from the dedicated endpoint
			const eventStartTime = marketData.eventStartTime || event.startDate;
			const priceToBeat = await this.getPriceToBeat(
				'BTC',
				eventStartTime,
				marketData.endDate,
			);

			return {
				conditionId: marketData.conditionId,
				questionId: marketData.questionID,
				slug: marketData.slug,
				eventTicker: event.ticker,
				title: event.title,
				startTime: new Date(eventStartTime),
				endTime: endDate,
				upTokenId: tokenIds[0],
				downTokenId: tokenIds[1],
				tickSize:
					marketData.orderPriceMinTickSize?.toString() ||
					config.tickSize,
				negRisk: marketData.negRisk || false,
				minOrderSize: marketData.orderMinSize || config.minOrderSize,
				priceToBeat,
			};
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			logger.debug(`No market found for slug ${slug}: ${message}`);
			return null;
		}
	}

	async getMarketPrices(market: Market): Promise<MarketPrices | null> {
		try {
			if (!this.clobClient)
				throw new Error('CLOB client not initialized');

			// Typesafe parallel fetching of both orderbooks using async library
			const { upBook, downBook } = await async.parallel<
				void,
				{ upBook: OrderBook; downBook: OrderBook }
			>({
				upBook: async () =>
					this.clobClient!.getOrderBook(market.upTokenId),
				downBook: async () =>
					this.clobClient!.getOrderBook(market.downTokenId),
			});

			const getMid = (book: OrderBook): number | null => {
				if (book.midpoint) return parseFloat(book.midpoint);

				const bestBidObj = book.bids?.length
					? book.bids[book.bids.length - 1]
					: null;
				const bestAskObj = book.asks?.length ? book.asks[0] : null;

				const bid = bestBidObj?.price
					? parseFloat(bestBidObj.price)
					: null;
				const ask = bestAskObj?.price
					? parseFloat(bestAskObj.price)
					: null;

				if (bid !== null && ask !== null) return (bid + ask) / 2;
				if (bid !== null) return bid;
				if (ask !== null) return ask;
				return null;
			};

			const upPrice = getMid(upBook);
			const downPrice = getMid(downBook);

			if (upPrice === null || downPrice === null) {
				return null;
			}

			const upBidObj = upBook.bids?.length
				? upBook.bids[upBook.bids.length - 1]
				: null;
			const upAskObj = upBook.asks?.length ? upBook.asks[0] : null;

			const upBid = upBidObj?.price ? parseFloat(upBidObj.price) : 0.49;
			const upAsk = upAskObj?.price ? parseFloat(upAskObj.price) : 0.51;

			return {
				upPrice,
				downPrice,
				bestBid: upBid,
				bestAsk: upAsk,
			};
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			logger.error(`Error fetching market prices: ${message}`);
			NotificationManager.handleError(
				error,
				'Polymarket',
				'getMarketPrices',
			);
			return null;
		}
	}

	async getTokenPrice(
		tokenId: string,
		_conditionId: string,
		_direction: string,
	): Promise<number | null> {
		try {
			if (!this.clobClient)
				throw new Error('CLOB client not initialized');

			const book: OrderBook = await this.clobClient.getOrderBook(tokenId);
			if (book.midpoint) {
				return parseFloat(book.midpoint);
			}

			const bestBidObj = book.bids?.length
				? book.bids[book.bids.length - 1]
				: null;
			const bestAskObj = book.asks?.length ? book.asks[0] : null;

			const bid = bestBidObj?.price ? parseFloat(bestBidObj.price) : null;
			const ask = bestAskObj?.price ? parseFloat(bestAskObj.price) : null;

			if (bid !== null && ask !== null) return (bid + ask) / 2;
			if (bid !== null) return bid;
			if (ask !== null) return ask;

			logger.warn(
				`No readable price found in token ${tokenId} orderbook: ${JSON.stringify(book).substring(0, 100)}`,
			);
			return null;
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			logger.error(
				`Error in getTokenPrice for token ${tokenId}: ${message}`,
			);
			return null;
		}
	}

	// ---- Trading Operations ----

	async placeBuyOrder(
		tokenId: string,
		price: number,
		size: number,
		market: Market,
	): Promise<unknown> {
		if (config.isDemo) {
			throw new Error('Cannot place real orders in demo mode');
		}
		if (!this.clobClient) throw new Error('CLOB client not initialized');

		try {
			const order = await this.clobClient.createAndPostOrder(
				{
					tokenID: tokenId,
					price,
					side: Side.BUY,
					size,
				},
				{
					tickSize: market.tickSize as any,
					negRisk: market.negRisk,
				},
				OrderType.GTC,
			);

			logger.trade('BUY ORDER PLACED', {
				tokenId: tokenId.substring(0, 12) + '...',
				price,
				size,
				orderId: (order as Record<string, unknown>)?.orderID,
			});
			return order;
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			logger.error(
				`Failed to place BUY order for ${tokenId}: ${message}`,
			);
			throw error;
		}
	}

	async placeSellOrder(
		tokenId: string,
		price: number,
		size: number,
		market: Pick<Market, 'tickSize' | 'negRisk'>,
	): Promise<unknown> {
		if (config.isDemo) {
			throw new Error('Cannot place real orders in demo mode');
		}
		if (!this.clobClient) throw new Error('CLOB client not initialized');

		try {
			const order = await this.clobClient.createAndPostOrder(
				{
					tokenID: tokenId,
					price,
					side: Side.SELL,
					size,
				},
				{
					tickSize: market.tickSize as any,
					negRisk: market.negRisk,
				},
				OrderType.GTC,
			);

			logger.trade('SELL ORDER PLACED', {
				tokenId: tokenId.substring(0, 12) + '...',
				price,
				size,
				orderId: (order as Record<string, unknown>)?.orderID,
			});
			return order;
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			logger.error(
				`Failed to place SELL order for ${tokenId}: ${message}`,
			);
			throw error;
		}
	}

	async cancelOrder(orderId: string): Promise<void> {
		if (config.isDemo || !this.clobClient) return;
		try {
			await this.clobClient.cancelOrder({ orderID: orderId } as any);
			logger.trade('ORDER CANCELLED', { orderId });
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			logger.error(`Error cancelling order: ${message}`);
		}
	}

	async getOpenOrders(): Promise<unknown[]> {
		if (config.isDemo || !this.clobClient) return [];
		try {
			const orders = await this.clobClient.getOpenOrders();
			return orders || [];
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			logger.error(`Error fetching open orders: ${message}`);
			return [];
		}
	}

	/**
	 * Redeems winning CTF tokens for USDC after a market resolves in our favor.
	 * Calls redeemPositions() on the Polymarket CTF contract on Polygon.
	 * No-op in demo mode. Errors are logged but not thrown so the trade is
	 * still recorded in Redis even if the on-chain redemption fails.
	 */
	async redeemWinnings(conditionId: string): Promise<void> {
		if (config.isDemo || !this.signer) return;

		const CTF_ADDRESS = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045';
		const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
		const CTF_ABI = [
			'function redeemPositions(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] indexSets) external',
		];

		try {
			const provider = new ethers.providers.JsonRpcProvider(
				config.polygonRpcUrl,
			);
			const connectedWallet = this.signer.connect(provider);
			const ctf = new ethers.Contract(
				CTF_ADDRESS,
				CTF_ABI,
				connectedWallet,
			);

			logger.info(
				`💰 Redeeming winning position on-chain for conditionId: ${conditionId}`,
			);

			const tx = await ctf.redeemPositions(
				USDC_ADDRESS,
				ethers.constants.HashZero,
				conditionId,
				[1, 2],
			);
			await tx.wait();

			logger.info(`✅ On-chain redemption confirmed. tx: ${tx.hash}`);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			logger.error(
				`⚠️ Failed to redeem winning position on-chain for ${conditionId}: ${message}. Manual redemption may be required.`,
			);
		}
	}
}

const polymarketService = new PolymarketService();
export default polymarketService;
