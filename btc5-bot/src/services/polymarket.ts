import { Wallet } from '@ethersproject/wallet';
import { RelayClient, RelayerTxType } from '@polymarket/builder-relayer-client';
import { BuilderConfig } from '@polymarket/builder-signing-sdk';
import { ClobClient, OrderType, Side } from '@polymarket/clob-client';
import { ClobOrder, Market, MarketPrices, OrderStatus } from '@shared/types';
import axios, { AxiosInstance } from 'axios';
import { ethers } from 'ethers';
import config, { validateLiveConfig } from '../config';
import logger from '../utils/logger';
import NotificationManager from './notificationManager';
import { getStrategyConfig } from './strategyConfig';
import polymarketWsService from './polymarketWs';
import * as async from 'async';
import {
	createWalletClient,
	encodeFunctionData,
	Hex,
	http,
	prepareEncodeFunctionData,
	zeroHash,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygon } from 'viem/chains';
import { Transaction } from '@polymarket/builder-relayer-client';

interface OrderBook {
	midpoint?: string;
	bids?: Array<{ price: string; size: string }>;
	asks?: Array<{ price: string; size: string }>;
}

interface OrderResponse {
	orderID: string;
	success: boolean;
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
	private builderConfig: BuilderConfig | null = null;

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
			await polymarketWsService.start();
			return;
		}

		validateLiveConfig();

		this.builderConfig = new BuilderConfig({
			localBuilderCreds: {
				key: config.builderApiKey,
				secret: config.builderApiSecret,
				passphrase: config.builderApiPassphrase,
			},
		});

		this.signer = new Wallet(
			config.privateKey,
			new ethers.providers.JsonRpcProvider(config.polygonRpcUrl),
		);
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
			undefined, // geoBlockToken
			undefined, // useServerTime
			this.builderConfig,
			undefined, // getSigner
			undefined, // retryOnError
			undefined, // tickSizeTtlMs
			true,
		);

		await polymarketWsService.start();

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
			if (market) {
				return market;
			}

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
			// 1. Try WebSocket First (Low Latency & Consistent)
			const wsUp = polymarketWsService.getPrice(market.upTokenId);
			const wsDown = polymarketWsService.getPrice(market.downTokenId);

			if (wsUp && wsDown) {
				return {
					upPrice: wsUp.midpoint,
					downPrice: wsDown.midpoint,
					bestBid: wsUp.bestBid,
					bestAsk: wsUp.bestAsk,
				};
			}

			// 2. Fallback to Midpoint REST API if WS prices aren't available
			logger.warn(
				`⚠️ WebSocket prices missing for ${market.slug}. Falling back to midpoint REST API.`,
			);

			// Trigger a reconnect in the background if we're falling back
			polymarketWsService.reconnect();

			if (!this.clobClient) {
				this.clobClient = new ClobClient(
					config.clobHost,
					config.chainId,
				);
			}

			const { up, down } = await async.parallel<
				void,
				{
					up: { mid: string };
					down: { mid: string };
				}
			>({
				up: async () => this.clobClient!.getMidpoint(market.upTokenId),
				down: async () =>
					this.clobClient!.getMidpoint(market.downTokenId),
			});

			if (up && down) {
				const upMid = parseFloat(up.mid);
				const downMid = parseFloat(down.mid);

				return {
					upPrice: upMid,
					downPrice: downMid,
					bestBid: upMid, // Use mid as proxy for bid/ask in fallback
					bestAsk: upMid,
				};
			}

			return null;
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
			// 1. WebSocket Only
			const wsP = polymarketWsService.getPrice(tokenId);
			if (wsP) return wsP.midpoint;

			// 2. Fallback to REST API
			logger.warn(
				`⚠️ WebSocket price missing for token ${tokenId}. Falling back to midpoint REST API.`,
			);

			if (!this.clobClient) {
				this.clobClient = new ClobClient(
					config.clobHost,
					config.chainId,
				);
			}

			const resp: { mid: string } | null =
				await this.clobClient.getMidpoint(tokenId);
			if (resp && resp.mid) {
				logger.info(`Token price for ${tokenId}: ${resp.mid}`);
				return parseFloat(resp.mid);
			}

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
	): Promise<ClobOrder | null> {
		if (config.isDemo) {
			throw new Error('Cannot place real orders in demo mode');
		}
		if (!this.clobClient) throw new Error('CLOB client not initialized');

		try {
			const order: OrderResponse =
				await this.clobClient.createAndPostOrder(
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

			if (!order || !order.orderID) {
				return null;
			}

			logger.trade('BUY ORDER PLACED', {
				tokenId: tokenId,
				price,
				size,
				orderId: order.orderID,
			});

			return this._monitorOrder(order.orderID, market.endTime);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			logger.error(
				`Failed to place BUY order for ${tokenId}: ${message}`,
			);
			return null;
		}
	}

	async placeSellOrder(
		tokenId: string,
		price: number,
		size: number,
		market: Pick<Market, 'tickSize' | 'negRisk' | 'endTime'>,
	): Promise<ClobOrder | null> {
		if (config.isDemo) {
			throw new Error('Cannot place real orders in demo mode');
		}
		if (!this.clobClient) throw new Error('CLOB client not initialized');

		try {
			const order: OrderResponse =
				await this.clobClient.createAndPostOrder(
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

			if (!order || !order.orderID) {
				return null;
			}

			logger.trade('SELL ORDER PLACED', {
				tokenId: tokenId,
				price,
				size,
				orderId: order.orderID,
			});

			return this._monitorOrder(order.orderID, market.endTime);
		} catch (error: any) {
			const message =
				error instanceof Error ? error.message : String(error);

			// Detect error detail from various possible structures (axios response vs flattened error)
			const errorData =
				error.response?.data ||
				error.data ||
				(typeof error === 'object' ? error : null);
			const errorDetail =
				typeof errorData?.error === 'string'
					? errorData.error
					: typeof errorData === 'string'
						? errorData
						: message;

			// Reactive balance adjustment: If the error is about insufficient balance,
			// parse the actual balance from the error message and retry ONCE.
			if (errorDetail.toLowerCase().includes('not enough balance')) {
				const match = errorDetail.match(/balance: (\d+)/);
				if (match && match[1]) {
					const rawBalance = parseInt(match[1], 10);
					const adjustedSize = rawBalance / 1_000_000;

					logger.warn(
						`⚠️ Insufficient balance for SELL order of ${tokenId}. CLOB Balance reported: ${rawBalance}. Retrying with adjusted size: ${adjustedSize}`,
					);

					if (adjustedSize > 0) {
						try {
							const retryOrder: OrderResponse =
								await this.clobClient.createAndPostOrder(
									{
										tokenID: tokenId,
										price,
										side: Side.SELL,
										size: adjustedSize,
									},
									{
										tickSize: market.tickSize as any,
										negRisk: market.negRisk,
									},
									OrderType.GTC,
								);

							if (retryOrder && retryOrder.orderID) {
								logger.info(
									`✅ Successfully retried SELL order with adjusted size: ${adjustedSize}`,
								);
								logger.trade('SELL ORDER PLACED (ADJUSTED)', {
									tokenId: tokenId,
									price,
									size: adjustedSize,
									orderId: retryOrder.orderID,
								});
								return this._monitorOrder(
									retryOrder.orderID,
									market.endTime,
								);
							}
						} catch (retryError: any) {
							logger.error(
								`Retry attempt failed for ${tokenId}: ${retryError.message}`,
							);
						}
					} else {
						logger.error(
							`Cannot retry SELL order for ${tokenId}: Adjusted size is 0.`,
						);
						return null;
					}
				}
			}

			logger.error(
				`Failed to place SELL order for ${tokenId}: ${errorDetail}`,
			);
			return null;
		}
	}

	async cancelOrder(orderId: string): Promise<void> {
		if (config.isDemo || !this.clobClient) return;
		try {
			await this.clobClient.cancelOrder({ orderID: orderId });
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

	async getOrder(orderId: string): Promise<ClobOrder | null> {
		if (config.isDemo || !this.clobClient) return null;
		try {
			const order = await this.clobClient.getOrder(orderId);
			logger.debug(`Order ${orderId}: ${JSON.stringify(order)}`);
			return { ...order, status: order.status as OrderStatus };
		} catch (error) {
			logger.error(`Error fetching order ${orderId}: ${error}`);
			// Silently fail for individual order fetches during monitoring if needed,
			// but we'll log it if it's a real error.
			return null;
		}
	}

	private async _monitorOrder(
		orderId: string,
		endTime: Date,
	): Promise<ClobOrder | null> {
		logger.info(
			`⏳ Internal monitoring for order ${orderId} until match or market close...`,
		);

		while (true) {
			const orderStatus = await this.getOrder(orderId);
			if (orderStatus && orderStatus.status !== OrderStatus.LIVE) {
				const matchedSize = parseFloat(orderStatus.size_matched || '0');
				if (
					orderStatus.status === OrderStatus.MATCHED ||
					matchedSize > 0
				) {
					logger.info(
						`✅ Order ${orderId} matched with size ${matchedSize} and status ${orderStatus.status} and price ${orderStatus.price}`,
					);
					return orderStatus;
				}
				return null;
			}

			if (new Date() >= endTime) {
				logger.info(
					`⏰ Market ended. Returning last known state for order ${orderId}. orderStatus: ${orderStatus}`,
				);
				const matchedSize = parseFloat(
					orderStatus?.size_matched || '0',
				);
				if (
					orderStatus?.status === OrderStatus.MATCHED ||
					matchedSize > 0
				) {
					return orderStatus;
				}
				return null;
			}

			// Poll every 1 second as requested
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}
	}

	isOrderStatusFinal(orderStatus: OrderStatus): boolean {
		return orderStatus !== OrderStatus.LIVE;
	}

	/**
	 * Redeems winning CTF tokens for USDC after a market resolves in our favor.
	 * Calls redeemPositions() on the Polymarket CTF contract on Polygon.
	 * No-op in demo mode. Errors are logged but not thrown so the trade is
	 * still recorded in Redis even if the on-chain redemption fails.
	 */
	async redeemWinnings(conditionId: string): Promise<void> {
		if (config.isDemo) return;

		try {
			const ctfRedeemAbi = [
				{
					constant: false,
					inputs: [
						{ name: 'collateralToken', type: 'address' },
						{ name: 'parentCollectionId', type: 'bytes32' },
						{ name: 'conditionId', type: 'bytes32' },
						{ name: 'indexSets', type: 'uint256[]' },
					],
					name: 'redeemPositions',
					outputs: [],
					payable: false,
					stateMutability: 'nonpayable',
					type: 'function',
				},
			];

			const ctfPrepared = prepareEncodeFunctionData({
				abi: ctfRedeemAbi,
				functionName: 'redeemPositions',
			});

			const account = privateKeyToAccount(config.privateKey as Hex);
			const wallet = createWalletClient({
				account,
				chain: polygon,
				transport: http(config.polygonRpcUrl),
			});

			const proxyClient = new RelayClient(
				'https://relayer-v2.polymarket.com/',
				137,
				wallet,
				this.builderConfig ||
					new BuilderConfig({
						localBuilderCreds: {
							key: config.builderApiKey,
							secret: config.builderApiSecret,
							passphrase: config.builderApiPassphrase,
						},
					}),
				RelayerTxType.PROXY,
			);

			const calldata = encodeFunctionData({
				...ctfPrepared,
				args: [config.addresses.usdc, zeroHash, conditionId, [1, 2]],
			});

			const redeemTx: Transaction = {
				to: config.addresses.ctf,
				data: calldata,
				value: '0',
			};

			logger.info(
				`💰 Submitting gasless redemption for conditionId: ${conditionId}`,
			);

			const response = await proxyClient.execute(
				[redeemTx],
				'redeem positions',
			);

			logger.info(
				`⏳ Gasless redemption submitted via Relayer for ${conditionId}. Waiting for confirmation...`,
			);

			const result = await response.wait();
			if (result) {
				logger.info(
					`✅ Proxy redeem completed: ${result.transactionHash}`,
				);
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			logger.error(
				`⚠️ Failed to submit gasless redemption for ${conditionId}: ${message}. Manual redemption or MATIC funding may be required.`,
			);
		}
	}

	/**
	 * Fetches the on-chain balance of a specific outcome token (ERC1155)
	 * for the configured funder address.
	 */
	async getTokenBalance(tokenId: string): Promise<number> {
		if (config.isDemo) return 0;
		if (!this.signer) throw new Error('Signer not initialized');

		const CTF_ADDRESS = '0x4d97dcd97ec945f40cf65f87097ace5ea0476045';
		const CTF_ABI = [
			'function balanceOf(address account, uint256 id) view returns (uint256)',
		];

		try {
			const ctf = new ethers.Contract(CTF_ADDRESS, CTF_ABI, this.signer);
			const balance = await ctf.balanceOf(config.funderAddress, tokenId);
			// Polymarket outcome tokens (ERC1155) use 6 decimals
			return parseFloat(ethers.utils.formatUnits(balance, 6));
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			logger.error(`Error checking balance for ${tokenId}: ${message}`);
			return 0;
		}
	}
}

const polymarketService = new PolymarketService();
export default polymarketService;
