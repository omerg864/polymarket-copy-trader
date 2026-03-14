import { Wallet } from '@ethersproject/wallet';
import type { Market, MarketPrices } from '@shared/types';
import { ClobClient, OrderType, Side } from '@polymarket/clob-client';
import axios, { AxiosInstance } from 'axios';
import config, { validateLiveConfig } from '../config';
import logger from '../utils/logger';
import NotificationManager from './notificationManager';

interface OrderBook {
	midpoint?: string;
	bids?: Array<{ price: string; size: string }>;
	asks?: Array<{ price: string; size: string }>;
}

interface GammaEvent {
	ticker: string;
	slug: string;
	title: string;
	startTime?: string;
	eventMetadata?: { priceToBeat?: number };
	markets?: Array<{
		conditionId: string;
		questionID: string;
		slug: string;
		endDate: string;
		eventStartTime?: string;
		closed: boolean;
		clobTokenIds: string;
		orderPriceMinTickSize?: number;
		negRisk?: boolean;
		orderMinSize?: number;
		outcomePrices: string;
		outcomes: string;
	}>;
}

class PolymarketService {
	private clobClient: ClobClient | null = null;
	private gammaApi: AxiosInstance;

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

		const signer = new Wallet(config.privateKey);
		const creds = await new ClobClient(
			config.clobHost,
			config.chainId,
			signer,
		).createOrDeriveApiKey();

		this.clobClient = new ClobClient(
			config.clobHost,
			config.chainId,
			signer,
			creds,
			config.signatureType,
			config.funderAddress,
		);

		logger.info('✅ Polymarket CLOB client initialized for LIVE trading');
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

			// If current market is found, check if it's still actionable (>60s left)
			if (market) {
				const msUntilEnd = market.endTime.getTime() - now.getTime();
				if (msUntilEnd >= 60000) {
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

			const market = event.markets?.[0];
			if (!market || !market.closed) return null;

			const prices: string[] = JSON.parse(market.outcomePrices);
			const outcomes: string[] = JSON.parse(market.outcomes);

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

			logger.info(`Found market event: ${JSON.stringify(event)}`);
			const market = event.markets?.[0];
			if (!market || market.closed) return null;

			const endDate = new Date(market.endDate);
			const now = new Date();
			if (endDate <= now) return null;

			const tokenIds: string[] = JSON.parse(market.clobTokenIds);
			return {
				conditionId: market.conditionId,
				questionId: market.questionID,
				slug: market.slug,
				eventTicker: event.ticker,
				title: event.title,
				startTime: new Date(
					event.startTime || market.eventStartTime || '',
				),
				endTime: endDate,
				upTokenId: tokenIds[0],
				downTokenId: tokenIds[1],
				tickSize:
					market.orderPriceMinTickSize?.toString() || config.tickSize,
				negRisk: market.negRisk || false,
				minOrderSize: market.orderMinSize || config.minOrderSize,
				priceToBeat: event.eventMetadata?.priceToBeat ?? null,
			};
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			logger.debug(`No market found for slug ${slug}: ${message}`);
			return null;
		}
	}

	async getMarketPrices(market: Market): Promise<MarketPrices> {
		try {
			if (!this.clobClient)
				throw new Error('CLOB client not initialized');

			const upBook: OrderBook = await this.clobClient.getOrderBook(
				market.upTokenId,
			);
			const downBook: OrderBook = await this.clobClient.getOrderBook(
				market.downTokenId,
			);

			const getMid = (book: OrderBook): number => {
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
				return 0.5;
			};

			const upBidObj = upBook.bids?.length
				? upBook.bids[upBook.bids.length - 1]
				: null;
			const upAskObj = upBook.asks?.length ? upBook.asks[0] : null;

			const upBid = upBidObj?.price ? parseFloat(upBidObj.price) : 0.49;
			const upAsk = upAskObj?.price ? parseFloat(upAskObj.price) : 0.51;

			return {
				upPrice: getMid(upBook),
				downPrice: getMid(downBook),
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
			return {
				upPrice: 0.5,
				downPrice: 0.5,
				bestBid: 0.49,
				bestAsk: 0.51,
			};
		}
	}

	async getTokenPrice(
		tokenId: string,
		_conditionId: string,
		_direction: string,
	): Promise<number> {
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
			return 0.5;
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			logger.error(
				`Error in getTokenPrice for token ${tokenId}: ${message}`,
			);
			return 0.5;
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
}

const polymarketService = new PolymarketService();
export default polymarketService;
