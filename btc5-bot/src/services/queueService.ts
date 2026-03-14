import { Queue, Worker, type Job } from 'bullmq';
import Redis from 'ioredis';
import { type Trade } from '@shared/types';
import config from '../config';
import logger from '../utils/logger';
import redisService from './redis';
import polymarketService from './polymarket';
import demoTradingService from './demoTrading';
import notificationManager from './notificationManager';
import { getStrategyConfig } from './strategyConfig';

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

export interface BalanceJobData {
	trade: Trade;
	revenue: number;
	sellFee: number;
	won: boolean;
}

class QueueService {
	private sellQueue: Queue<SellJobData>;
	private balanceQueue: Queue<BalanceJobData>;
	private sellWorker: Worker<SellJobData>;
	private balanceWorker: Worker<BalanceJobData>;

	constructor() {
		this.sellQueue = new Queue('sell-trades', {
			connection: connection as any,
		});
		this.balanceQueue = new Queue('balance-update', {
			connection: connection as any,
		});

		// Sell Worker: Handles concurrent trade exits
		this.sellWorker = new Worker<SellJobData>(
			'sell-trades',
			async (job) => this.processSellTrade(job),
			{ connection: connection as any, concurrency: 5 },
		);

		// Balance Worker: Handles strictly sequential balance updates
		this.balanceWorker = new Worker<BalanceJobData>(
			'balance-update',
			async (job) => this.processBalanceUpdate(job),
			{ connection: connection as any, concurrency: 1 },
		);

		this.setupListeners();
	}

	private setupListeners() {
		this.sellWorker.on('failed', (job, err) => {
			logger.error(`Sell job ${job?.id} failed: ${err.message}`);
		});
		this.balanceWorker.on('failed', (job, err) => {
			logger.error(`Balance job ${job?.id} failed: ${err.message}`);
		});
	}

	/**
	 * Adds a trade to the sell queue.
	 * Job ID is the trade ID to prevent duplicates in the queue.
	 */
	async addSellJob(data: SellJobData): Promise<void> {
		try {
			await this.sellQueue.add(`sell-${data.trade.id}`, data, {
				jobId: data.trade.id,
				removeOnComplete: true,
				removeOnFail: false,
				attempts: 3,
				backoff: { type: 'exponential', delay: 1000 },
			});
			logger.info(`📦 Queued ${data.type} for trade ${data.trade.id}`);
		} catch (error) {
			logger.error(`Failed to queue sell job: ${error}`);
		}
	}

	private async processSellTrade(job: Job<SellJobData>): Promise<void> {
		const { trade, type, exitPrice, btcPrice, reason } = job.data;

		// 1. Check if already in history
		const isProcessed = await redisService.isTradeInHistory(trade.id);
		if (isProcessed) {
			logger.warn(
				`⚠️ Trade ${trade.id} already processed. Skipping sell job.`,
			);
			return;
		}

		let won = false;
		let finalPrice = exitPrice ?? 0;
		let sellFee = 0;

		if (type === 'RESOLVE') {
			logger.info(
				`⏰ Resolving trade via market resolution: ${trade.title}`,
			);
			const winner = await polymarketService.getMarketOutcome(
				trade.eventTicker,
			);
			if (!winner) {
				throw new Error('Market not yet resolved on Polymarket');
			}
			won = trade.direction === winner;
			finalPrice = won ? 1.0 : 0.0;

			if (config.isDemo) {
				// Internal demo resolution
				await demoTradingService.resolveTrade(trade, won);
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
				await polymarketService.placeSellOrder(
					trade.tokenId,
					finalPrice,
					trade.size,
					market,
				);
				sellFee = (trade.cost / trade.size) * trade.size * 0.0175;
			} else {
				await demoTradingService.placeSellOrder(
					trade,
					finalPrice,
					reason || 'sell',
					btcPrice,
				);
			}
			won = finalPrice > trade.entryPrice;
		}

		// Prepare data for balance update
		trade.status = type === 'RESOLVE' ? 'resolved' : 'closed_sell';
		trade.exitPrice = finalPrice;
		trade.exitBtcPrice = btcPrice;

		const revenue = finalPrice * trade.size;

		await this.balanceQueue.add(
			`balance-${trade.id}`,
			{
				trade,
				revenue,
				sellFee,
				won,
			},
			{
				jobId: `balance-${trade.id}`,
				removeOnComplete: true,
				attempts: 5,
				backoff: { type: 'fixed', delay: 1000 },
			},
		);
	}

	private async processBalanceUpdate(
		job: Job<BalanceJobData>,
	): Promise<void> {
		const { trade, revenue, sellFee, won } = job.data;

		// Double check history IDs (concurrency: 1 makes this very safe)
		const isProcessed = await redisService.isTradeInHistory(trade.id);
		if (isProcessed) {
			logger.warn(
				`⚠️ Trade ${trade.id} already in history IDs. Skipping balance update.`,
			);
			return;
		}

		const totalFee = (trade.fee || 0) + sellFee;
		trade.pnl = revenue - trade.cost - totalFee;
		trade.fee = totalFee;
		trade.closedAt = new Date().toISOString();

		// Update database/Redis
		await redisService.removeTrade(trade.id);
		await redisService.saveTradeHistory(trade); // This now also adds to history_ids

		const sc = await getStrategyConfig();
		const bal = await redisService.getBotBalance(sc);
		await redisService.setBotBalance(bal + revenue - sellFee);

		const stats = await redisService.getBotStats();
		stats.totalTrades += 1;
		if (trade.pnl >= 0) stats.wins += 1;
		else stats.losses += 1;
		stats.totalPnl += trade.pnl;
		stats.totalFees += totalFee;
		await redisService.updateBotStats(stats);

		// Trigger notification
		await notificationManager.handleTradeClosed(trade, stats);

		logger.info(
			`✅ Sequential balance update complete for trade ${trade.id}. PnL: $${trade.pnl.toFixed(2)}`,
		);
	}
}

export const queueService = new QueueService();
export default queueService;
