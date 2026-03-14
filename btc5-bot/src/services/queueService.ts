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

export interface TradeCompletionJobData {
	trade: Trade;
	revenue: number;
	sellFee: number;
	won: boolean;
	status: Trade['status'];
}

class QueueService {
	private sellQueue: Queue<SellJobData>;
	private completionQueue: Queue<TradeCompletionJobData>;
	private sellWorker: Worker<SellJobData>;
	private completionWorker: Worker<TradeCompletionJobData>;

	constructor() {
		this.sellQueue = new Queue('sell-trades', {
			connection: connection as any,
		});
		this.completionQueue = new Queue('trade-completion', {
			connection: connection as any,
		});

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
	}

	private setupListeners() {
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
		let status: Trade['status'] = 'open';

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
			status = won ? 'won' : 'lost';
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
			}
			// In both demo and live, we let the completion worker handle the final state and stats
			won = finalPrice > trade.entryPrice;
			status =
				reason === 'tp'
					? 'closed_tp'
					: reason === 'sl'
						? 'closed_sl'
						: 'closed_sell';
		}

		// Prepare data for sequential completion
		await this.completionQueue.add(
			`complete-${trade.id}`,
			{
				trade,
				revenue: finalPrice * trade.size,
				sellFee,
				won,
				status,
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
		const { trade, revenue, sellFee, status } = job.data;

		// Double check history IDs (concurrency: 1 makes this very safe)
		const isProcessed = await redisService.isTradeInHistory(trade.id);
		if (isProcessed) {
			logger.warn(
				`⚠️ Trade ${trade.id} already in history IDs. Skipping completion update.`,
			);
			return;
		}

		const totalFee = (trade.fee || 0) + sellFee;
		trade.pnl = revenue - trade.cost - totalFee;
		trade.fee = totalFee;
		trade.status = status;
		trade.closedAt = new Date().toISOString();

		// Update database/Redis
		await redisService.removeTrade(trade.id);
		await redisService.saveTradeHistory(trade); // This adds to history_ids

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
			`✅ Sequential completion update for trade ${trade.id}. PnL: $${trade.pnl.toFixed(2)}`,
		);
	}
}

export const queueService = new QueueService();
export default queueService;
