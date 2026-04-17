import { Queue, Worker, type Job } from 'bullmq';
import Redis from 'ioredis';
import { type Trade, TradeStatus } from '@shared/types';
import { calculateFee } from '@shared/utils';
import config from '../config';
import logger from '../utils/logger';
import redisService from './redis';
import polymarketService from './polymarket';
import notificationManager from './notificationManager';
import { getStrategyConfig } from './strategyConfig';
import tradeService from './tradeService';
import { DateTime } from 'luxon';

// BullMQ connection must have maxRetriesPerRequest: null
const connection = new Redis(config.redisUrl, {
	maxRetriesPerRequest: null,
	lazyConnect: true,
});

export interface SellJobData {
	trade: Trade;
	type: 'SELL_ORDER' | 'RESOLVE';
	exitPrice?: number;
	btcPrice?: number;
	reason?: string;
}

export interface TradeCompletionJobData {
	trade: Trade;
	revenue: number;
	sellFee: number;
	won: boolean;
	status: Trade['status'];
	exitPrice: number;
	exitBtcPrice?: number;
	reason?: string;
}

class QueueService {
	private sellQueue: Queue<SellJobData>;
	private completionQueue: Queue<TradeCompletionJobData>;
	private sellWorker: Worker<SellJobData> | null = null;
	private completionWorker: Worker<TradeCompletionJobData> | null = null;

	constructor() {
		this.sellQueue = new Queue('sell-trades', {
			connection: connection as any,
		});
		this.completionQueue = new Queue('trade-completion', {
			connection: connection as any,
		});
	}

	/**
	 * Starts the BullMQ workers.
	 * Called during bot initialization.
	 */
	async startWorkers(): Promise<void> {
		if (this.sellWorker || this.completionWorker) {
			logger.warn('⚠️ Workers are already running');
			return;
		}

		logger.info('🚀 Starting BullMQ workers...');

		// Sell Worker: Handles concurrent trade exits
		this.sellWorker = new Worker<SellJobData>(
			'sell-trades',
			async (job) => this.processSellTrade(job),
			{ connection: connection as any, concurrency: 5 },
		);

		// Completion Worker: Handles strictly sequential balance and stats updates
		this.completionWorker = new Worker<TradeCompletionJobData>(
			'trade-completion',
			async (job) => this.processTradeCompletion(job),
			{ connection: connection as any, concurrency: 1 },
		);

		this.setupListeners();
		logger.info('✅ BullMQ workers started');
	}

	/**
	 * Gracefully stops the BullMQ workers.
	 */
	async stopWorkers(): Promise<void> {
		logger.info('🛑 Stopping BullMQ workers...');
		if (this.sellWorker) await this.sellWorker.close();
		if (this.completionWorker) await this.completionWorker.close();
		this.sellWorker = null;
		this.completionWorker = null;
		logger.info('✅ BullMQ workers stopped');
	}

	private setupListeners() {
		if (!this.sellWorker || !this.completionWorker) return;

		this.sellWorker.on('failed', (job, err) => {
			logger.error(`Sell job ${job?.id} failed: ${err.message}`);
		});
		this.completionWorker.on('failed', (job, err) => {
			logger.error(`Completion job ${job?.id} failed: ${err.message}`);
		});
	}

	/**
	 * Adds a trade to the sell queue.
	 * Job ID is the trade ID to prevent duplicates in the queue.
	 */
	async addSellJob(data: SellJobData): Promise<void> {
		try {
			const isResolve = data.type === 'RESOLVE';

			// Resolve jobs need much longer retry windows because Polymarket
			// resolution metadata can lag behind market end time.
			const attempts = isResolve ? 60 : 5;
			const backoffDelay = isResolve ? 60000 : 2000; // Resolution: 60s | Sell: 2s
			const backoffType = isResolve ? 'fixed' : 'exponential';

			await this.sellQueue.add(`sell-${data.trade.id}`, data, {
				jobId: data.trade.id,
				removeOnComplete: true,
				removeOnFail: false,
				attempts,
				backoff: { type: backoffType, delay: backoffDelay },
			});
			logger.info(`📦 Queued ${data.type} for trade ${data.trade.id}`);
		} catch (error) {
			logger.error(`Failed to queue sell job: ${error}`);
		}
	}

	private async processSellTrade(job: Job<SellJobData>): Promise<void> {
		const { trade, type, exitPrice, btcPrice, reason } = job.data;

		logger.info(`Processing sell job for trade ${trade.id}`);

		// Defensive check for Redis connection
		try {
			await redisService.connect();
		} catch (error) {
			logger.error(
				`Failed to ensure Redis connection for job ${job.id}: ${error}`,
			);
			throw new Error('Redis connection required');
		}

		// 1. Check if already in history
		const isProcessed = await redisService.isTradeInHistory(trade.id);
		if (isProcessed) {
			logger.warn(
				`⚠️ Trade ${trade.id} already processed. Skipping sell job. Removing from active trades.`,
			);
			await redisService.removeTrade(trade.id);
			return;
		}

		let won = false;
		let finalPrice = exitPrice ?? 0;
		let sellFee = 0;
		let status: TradeStatus = TradeStatus.OPEN;
		let revenue = 0;

		const endTime = trade.endTime ? new Date(trade.endTime) : null;

		if (type === 'RESOLVE') {
			logger.info(
				`⏰ Resolving trade via market resolution: ${trade.title}`,
			);
			if (!config.isDemo) {
				const actualBalance = await polymarketService.getTokenBalance(
					trade.tokenId,
				);
				if (actualBalance < trade.size) {
					logger.warn(
						`⚠️ Partial fill detected for RESOLVE trade ${trade.id}. Adjusting size: ${trade.size} -> ${actualBalance}`,
					);
					trade.size = actualBalance;
				}
			}

			const winner = await polymarketService.getMarketOutcome(
				trade.eventTicker,
			);
			if (!winner) {
				throw new Error('Market not yet resolved on Polymarket');
			}
			won = trade.direction === winner;

			// Resolve with partial fill awareness (from previous sell attempts)
			if (trade.partialFill) {
				const remainingShares = trade.size - trade.partialFill.size;
				const resolutionPrice = won ? 1.0 : 0.0;
				revenue =
					trade.partialFill.size * trade.partialFill.price +
					remainingShares * resolutionPrice;
				sellFee = trade.partialFill.fee;
				finalPrice =
					trade.size > 0 ? revenue / trade.size : resolutionPrice;
				logger.info(
					`🎯 Resolved partial fill trade ${trade.id}. Result: ${winner}. Partial: ${trade.partialFill.size}@${trade.partialFill.price}, Resolution: ${remainingShares}@${resolutionPrice}. Total Revenue: $${revenue.toFixed(2)}`,
				);
			} else {
				finalPrice = won ? 1.0 : 0.0;
				revenue = finalPrice * trade.size;
				sellFee = 0;
			}

			status = won ? TradeStatus.WON : TradeStatus.LOST;

			if (won && !config.isDemo) {
				await polymarketService.redeemWinnings(trade.conditionId);
			}
		} else {
			// SELL_ORDER (TP/SL/FCT)
			logger.info(
				`🟢 Executing ${reason || 'sell'} order for ${trade.title}`,
			);

			if (!config.isDemo) {
				const market = {
					conditionId: trade.conditionId,
					tickSize: config.tickSize,
					negRisk: config.negRisk,
				};

				// Verify actual balance before selling to handle partial fills
				const actualBalance = await polymarketService.getTokenBalance(
					trade.tokenId,
				);

				let sellSize = trade.size;
				if (actualBalance < trade.size) {
					logger.warn(
						`⚠️ Partial fill detected for trade ${trade.id}. Adjusting sell size: ${trade.size} -> ${actualBalance}`,
					);
					sellSize = actualBalance;
					trade.size = sellSize; // Update trade object to reflect actual holdings
				}

				if (sellSize <= 0) {
					logger.error(
						`❌ Cannot place sell order for trade ${trade.id}: Zero balance found.`,
					);
					throw new Error('Zero balance for sell order');
				}

				const order = await polymarketService.placeSellOrder(
					trade.tokenId,
					finalPrice,
					sellSize,
					market,
				);

				if (order && order.orderID) {
					const orderId = order.orderID;
					let filledSize = 0;
					let isClosed = false;

					// Monitor loop until filled or market closes
					logger.info(
						`⏳ Monitoring sell order ${orderId} for trade ${trade.id} until market close...`,
					);

					while (true) {
						const now = new Date();
						const orderStatus =
							await polymarketService.getOrder(orderId);

						if (orderStatus) {
							filledSize = parseFloat(
								orderStatus.size_matched || '0',
							);
							if (orderStatus.status === 'FILLED') {
								logger.info(
									`✅ Sell order ${orderId} fully filled.`,
								);
								break;
							}
							if (
								orderStatus.status === 'CANCELED' ||
								orderStatus.status === 'EXPIRED'
							) {
								logger.warn(
									`⚠️ Sell order ${orderId} was ${orderStatus.status}.`,
								);
								isClosed = true;
								break;
							}
						}

						// Check if market has ended
						if (endTime && now >= endTime) {
							logger.info(
								`⏰ Market ended for ${trade.title}. Cancelling remaining sell order.`,
							);
							await polymarketService.cancelOrder(orderId);
							isClosed = true;
							break;
						}

						// Poll every 5 seconds
						await new Promise((resolve) =>
							setTimeout(resolve, 5000),
						);
					}

					const partialFillFee = calculateFee(filledSize, finalPrice);

					// Handle partial fill: save data and re-queue for resolution
					if (isClosed && filledSize < trade.size) {
						const remainingShares = trade.size - filledSize;
						logger.info(
							`📋 Trade ${trade.id} partially filled (${filledSize}/${trade.size}). Queuing RESOLVE job for remaining ${remainingShares} shares.`,
						);

						// Record partial fill info
						trade.partialFill = {
							size: filledSize,
							price: finalPrice,
							fee: partialFillFee,
						};

						// Save to Redis so it's persisted for the next job
						await redisService.saveTrade(trade);

						// Queue standard RESOLVE job (jobId with suffix to avoid conflict with current running job)
						await this.addSellJob({
							trade,
							type: 'RESOLVE',
							reason: reason || 'partial_fill_resolution',
						});

						return; // EXIT early, do not complete trade yet
					}

					// Full fill case
					revenue = filledSize * finalPrice;
					sellFee = partialFillFee;
					finalPrice =
						trade.size > 0 ? revenue / trade.size : finalPrice;
				} else {
					// User requested: throw error if placeSellOrder fails or missing orderID
					logger.error(
						`❌ placeSellOrder failed for trade ${trade.id}. Throwing error for worker retry.`,
					);
					throw new Error(
						`Failed to place sell order for ${trade.id} (no orderID returned)`,
					);
				}
			} else {
				// Demo mode: assume full fill at limit price
				revenue = finalPrice * trade.size;
			}

			won = finalPrice > trade.entryPrice;
			status =
				reason === 'tp'
					? TradeStatus.CLOSED_TP
					: reason === 'sl'
						? TradeStatus.CLOSED_SL
						: reason === 'fct'
							? TradeStatus.CLOSED_FCT
							: TradeStatus.CLOSED_SELL;
		}

		// Prepare data for sequential completion
		await this.completionQueue.add(
			`complete-${trade.id}`,
			{
				trade,
				revenue,
				sellFee,
				won,
				status,
				exitPrice: finalPrice,
				exitBtcPrice: btcPrice,
				reason,
			},
			{
				jobId: `complete-${trade.id}`,
				removeOnComplete: true,
				attempts: 5,
				backoff: { type: 'fixed', delay: 1000 },
			},
		);
	}

	private async processTradeCompletion(
		job: Job<TradeCompletionJobData>,
	): Promise<void> {
		const { trade, revenue, sellFee, status, exitPrice, exitBtcPrice } =
			job.data;

		// Defensive check for Redis connection
		try {
			await redisService.connect();
		} catch (error) {
			logger.error(
				`Failed to ensure Redis connection for completion job ${job.id}: ${error}`,
			);
			throw new Error('Redis connection required');
		}

		// Double check history IDs (concurrency: 1 makes this very safe)
		const isProcessed = await redisService.isTradeInHistory(trade.id);
		if (isProcessed) {
			logger.warn(
				`⚠️ Trade ${trade.id} already in history IDs. Skipping completion update.`,
			);
			return;
		}

		const sc = await getStrategyConfig();
		const baseDate = trade.enteredAt
			? DateTime.fromISO(trade.enteredAt)
			: DateTime.now();
		const todayStr = baseDate.setZone(sc.timezone).toISODate() || '';

		const totalFee = (trade.fee || 0) + sellFee;
		trade.pnl = revenue - trade.cost - totalFee;
		trade.fee = totalFee;
		trade.status = status;
		trade.exitPrice = exitPrice;
		trade.exitBtcPrice = exitBtcPrice;
		trade.pctChange =
			trade.entryPrice > 0
				? (exitPrice - trade.entryPrice) / trade.entryPrice
				: 0;
		trade.closedAt = new Date().toISOString();

		if (status === TradeStatus.WON) {
			trade.actualOutcome = trade.direction;
		} else if (status === TradeStatus.LOST) {
			trade.actualOutcome = trade.direction === 'UP' ? 'DOWN' : 'UP';
		}

		// Update database/Redis
		try {
			await redisService.removeTrade(trade.id);
		} catch (error) {
			logger.error(`Failed to remove trade ${trade.id}: ${error}`);
		}

		await tradeService.saveTradeHistory(trade);

		const bal = await redisService.getBotBalance(sc);
		const newBalance = bal + revenue - sellFee;
		await redisService.setBotBalance(newBalance);

		// Increment daily PnL counter (Optimized)
		if (trade.pnl !== undefined) {
			await redisService.incrementDailyPnl(
				todayStr,
				trade.pnl,
				trade.pnl >= 0,
			);
		}

		const stats = await redisService.getBotStats();
		stats.totalTrades += 1;
		if (trade.pnl >= 0) stats.wins += 1;
		else stats.losses += 1;
		stats.totalPnl += trade.pnl;
		stats.totalFees += totalFee;
		await redisService.updateBotStats(stats);

		const todayPnL = await redisService.getDailyPnl(todayStr);

		if (sc.dailyTakeProfit >= 0 && todayPnL >= sc.dailyTakeProfit) {
			logger.info(
				`⏹️ Daily Take Profit reached ($${todayPnL.toFixed(2)}). Stopping for the day.`,
			);
			await redisService.setDailyStop(true, todayStr);
		} else if (sc.dailyStopLoss <= 0 && todayPnL <= sc.dailyStopLoss) {
			logger.info(
				`⏹️ Daily Stop Loss reached ($${todayPnL.toFixed(2)}). Stopping for the day.`,
			);
			await redisService.setDailyStop(true, todayStr);
		}

		// Trigger notification
		await notificationManager.handleTradeClosed(trade, stats, newBalance);

		logger.info(
			`✅ Sequential completion update for trade ${trade.id}. PnL: $${trade.pnl.toFixed(2)}`,
		);
	}
}

export const queueService = new QueueService();
export default queueService;
