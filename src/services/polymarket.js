import axios from 'axios';
import { ClobClient, Side, OrderType } from '@polymarket/clob-client';
import { Wallet } from '@ethersproject/wallet';
import config, { validateLiveConfig } from '../config.js';
import logger from '../utils/logger.js';

class PolymarketService {
	constructor() {
		this.clobClient = null;
		this.gammaApi = axios.create({
			baseURL: config.gammaHost,
			timeout: 10000,
		});
	}

	async initialize() {
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

	/**
	 * Construct the slug for a BTC 5-minute market based on a Unix epoch.
	 * Market slugs follow the pattern: btc-updown-5m-{end_epoch}
	 * where end_epoch is the Unix timestamp of the 5-minute boundary.
	 */
	_getMarketSlug(epochSeconds) {
		return `btc-updown-5m-${epochSeconds}`;
	}

	/**
	 * Calculate the next 5-minute boundary epoch from the given time.
	 */
	_getCurrentFiveMinBoundary(date = new Date()) {
		const epoch = Math.floor(date.getTime() / 1000);
		const fiveMin = 300;
		return Math.floor(epoch / fiveMin) * fiveMin;
	}

	async getNextMarket() {
		try {
			const now = new Date();
			const currentStart = this._getCurrentFiveMinBoundary(now);
			const nextStart = currentStart + 300; // +5 minutes

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
			logger.error(`Error fetching next market: ${error.message}`);
			return null;
		}
	}

	/**
	 * Fetch the actual resolved outcome for a closed market.
	 * Returns 'UP', 'DOWN', or null if not yet resolved.
	 */
	async getMarketOutcome(slug) {
		try {
			const response = await this.gammaApi.get('/events', {
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

			const prices = JSON.parse(market.outcomePrices);
			const outcomes = JSON.parse(market.outcomes);

			// Find the winning outcome (price = "1")
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
			logger.debug(`Error fetching market outcome: ${error.message}`);
			return null;
		}
	}

	async _fetchMarketBySlug(slug) {
		try {
			const response = await this.gammaApi.get('/events', {
				params: { slug },
			});

			const events = response.data;
			if (!Array.isArray(events) || events.length === 0) return null;

			// Verify the event is actually the BTC 5m market we requested (exact slug match)
			const event = events.find(
				(e) => e.ticker === slug || e.slug === slug,
			);
			if (!event) return null;

			const market = event.markets?.[0];
			if (!market || market.closed) return null;

			const endDate = new Date(market.endDate);
			const now = new Date();
			if (endDate <= now) return null;

			const tokenIds = JSON.parse(market.clobTokenIds);
			return {
				conditionId: market.conditionId,
				questionId: market.questionID,
				slug: market.slug,
				eventTicker: event.ticker,
				title: event.title,
				startTime: new Date(event.startTime || market.eventStartTime),
				endTime: endDate,
				upTokenId: tokenIds[0],
				downTokenId: tokenIds[1],
				tickSize:
					market.orderPriceMinTickSize?.toString() || config.tickSize,
				negRisk: market.negRisk || false,
				minOrderSize: market.orderMinSize || config.minOrderSize,
				priceToBeat: event.eventMetadata?.priceToBeat,
			};
		} catch (error) {
			logger.debug(`No market found for slug ${slug}: ${error.message}`);
			return null;
		}
	}

	async getMarketPrices(market) {
		try {
			const upBook = await this.clobClient.getOrderBook(market.upTokenId);
			const downBook = await this.clobClient.getOrderBook(
				market.downTokenId,
			);

			const getMid = (book) => {
				if (book.midpoint) return parseFloat(book.midpoint);

				// bids are [0.01, ..., 0.49] so best bid is last
				const bestBidObj =
					book.bids?.length > 0
						? book.bids[book.bids.length - 1]
						: null;
				// asks are [0.51, ..., 0.99] so best ask is first
				const bestAskObj = book.asks?.length > 0 ? book.asks[0] : null;

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

			const upBidObj =
				upBook.bids?.length > 0
					? upBook.bids[upBook.bids.length - 1]
					: null;
			const upAskObj = upBook.asks?.length > 0 ? upBook.asks[0] : null;

			const upBid = upBidObj?.price ? parseFloat(upBidObj.price) : 0.49;
			const upAsk = upAskObj?.price ? parseFloat(upAskObj.price) : 0.51;

			return {
				upPrice: getMid(upBook),
				downPrice: getMid(downBook),
				bestBid: upBid,
				bestAsk: upAsk,
			};
		} catch (error) {
			logger.error(`Error fetching market prices: ${error.message}`);
			return {
				upPrice: 0.5,
				downPrice: 0.5,
				bestBid: 0.49,
				bestAsk: 0.51,
			};
		}
	}

	async getTokenPrice(tokenId, conditionId, direction) {
		try {
			const book = await this.clobClient.getOrderBook(tokenId);
			if (book.midpoint) {
				return parseFloat(book.midpoint);
			}

			// bids are [0.01, ..., 0.49] so best bid is last
			const bestBidObj =
				book.bids?.length > 0 ? book.bids[book.bids.length - 1] : null;
			// asks are [0.51, ..., 0.99] so best ask is first
			const bestAskObj = book.asks?.length > 0 ? book.asks[0] : null;

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
			logger.error(
				`Error in getTokenPrice for token ${tokenId}: ${error.message}`,
			);
			return 0.5;
		}
	}

	// ---- Trading Operations ----

	async placeBuyOrder(tokenId, price, size, market) {
		if (config.isDemo) {
			throw new Error('Cannot place real orders in demo mode');
		}

		const order = await this.clobClient.createAndPostOrder(
			{
				tokenID: tokenId,
				price,
				side: Side.BUY,
				size,
			},
			{
				tickSize: market.tickSize,
				negRisk: market.negRisk,
			},
			OrderType.GTC,
		);

		logger.trade('BUY ORDER PLACED', {
			tokenId: tokenId.substring(0, 12) + '...',
			price,
			size,
			orderId: order?.orderID,
		});
		return order;
	}

	async placeSellOrder(tokenId, price, size, market) {
		if (config.isDemo) {
			throw new Error('Cannot place real orders in demo mode');
		}

		const order = await this.clobClient.createAndPostOrder(
			{
				tokenID: tokenId,
				price,
				side: Side.SELL,
				size,
			},
			{
				tickSize: market.tickSize,
				negRisk: market.negRisk,
			},
			OrderType.GTC,
		);

		logger.trade('SELL ORDER PLACED', {
			tokenId: tokenId.substring(0, 12) + '...',
			price,
			size,
			orderId: order?.orderID,
		});
		return order;
	}

	async cancelOrder(orderId) {
		if (config.isDemo || !this.clobClient) return;
		try {
			await this.clobClient.cancelOrder(orderId);
			logger.trade('ORDER CANCELLED', { orderId });
		} catch (error) {
			logger.error(`Error cancelling order: ${error.message}`);
		}
	}

	async getOpenOrders() {
		if (config.isDemo || !this.clobClient) return [];
		try {
			const orders = await this.clobClient.getOpenOrders();
			return orders || [];
		} catch (error) {
			logger.error(`Error fetching open orders: ${error.message}`);
			return [];
		}
	}
}

const polymarketService = new PolymarketService();
export default polymarketService;
