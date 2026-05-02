import {
	Market,
	OrderStatus,
	TradeStatus,
	TradeType,
	type Trade,
} from '@shared/types';
import { DateTime } from 'luxon';
import { calculateFee, isTimeExcluded } from '@shared/utils';
import config from '../config';
import demoTradingService from '../services/demoTrading';
import notificationManager from '../services/notificationManager';
import polymarketService from '../services/polymarket';
import queueService from '../services/queueService';
import redisService from '../services/redis';
import { getStrategyConfig } from '../services/strategyConfig';
import logger from '../utils/logger';
import riskManager from './riskManager';
import copyTraderService, { ClobTrade } from '../services/copyTrader';

/**
 * Strategy Engine — Copy Trader:
 * 1. Fetch target wallets from config
 * 2. Poll latest trades for each wallet
 * 3. Replicate BUY orders
 * 4. Replicate SELL orders (close open positions)
 * 5. Monitor resolution
 */
class StrategyEngine {
	private running = false;
	private loopTimer: ReturnType<typeof setTimeout> | null = null;

	async start(): Promise<void> {
		this.running = true;
		const sc = await getStrategyConfig();
		logger.info('');
		logger.info('═══════════════════════════════════════════════');
		logger.info('  🤖 Polymarket Copy Trader Bot Started');
		logger.info(
			`  Mode: ${config.mode.toUpperCase()} (${config.isDemo ? 'paper trading' : 'real money'})`,
		);
		logger.info(
			`  Wallets: ${sc.wallets.length} target(s) | Order Size: $${sc.fixedOrderSizeUsd}`,
		);
		logger.info('═══════════════════════════════════════════════');
		logger.info('');

		await riskManager.startMonitoring();
		await redisService.setBotStartTime(Date.now());

		this.scheduleNextCycle(0);
	}

	async stop(): Promise<void> {
		this.running = false;
		riskManager.stopMonitoring();
		if (this.loopTimer) {
			clearTimeout(this.loopTimer);
			this.loopTimer = null;
		}

		if (config.isDemo) {
			await demoTradingService.printStats();
		}

		logger.info('🛑 Trading bot stopped');
	}

	private scheduleNextCycle(delayMs: number): void {
		if (!this.running) return;
		this.loopTimer = setTimeout(async () => {
			try {
				await this.executeCycle();
			} catch (error) {
				const message =
					error instanceof Error ? error.message : String(error);
				const stack = error instanceof Error ? error.stack : '';
				logger.error(`Strategy cycle error: ${message}`);
				if (stack) logger.error(stack);
				await notificationManager.handleError(
					error,
					'StrategyEngine',
					'executeCycle',
				);
			}
			const sc = await getStrategyConfig();
			this.scheduleNextCycle(sc.cycleIntervalMs);
		}, delayMs);
	}

	private async executeCycle(): Promise<void> {
		const sc = await getStrategyConfig();
		const isStopping = await redisService.isStopRequested();

		// Step 1: Resolve any expired trades first
		const activeTrades = await redisService.getActiveTrades();
		await this.resolveExpiredTrades(activeTrades);

		if (isStopping) {
			logger.info('⏸️ Bot paused. Not entering new trades.');
			return;
		}

		// Step 2: Check for daily limits
		const dailyStop = await redisService.getDailyStop();
		const todayStr = DateTime.now().setZone(sc.timezone).toISODate();

		if (dailyStop && dailyStop.stopped && dailyStop.date === todayStr) {
			logger.info('Daily stop reached. No new trades today.');
			return;
		}

		if (dailyStop && dailyStop.date !== todayStr) {
			await redisService.setDailyStop(false, todayStr || '');
		}

		// Step 2.1: Check for excluded time windows
		if (sc.excludedTimeWindows && sc.excludedTimeWindows.length > 0) {
			const nowTz = DateTime.now().setZone(sc.timezone);
			for (const window of sc.excludedTimeWindows) {
				if (isTimeExcluded(nowTz, window)) {
					logger.info(
						`🚫 Current time ${nowTz.toFormat('HH:mm')} is within exclusion window ${window.start}-${window.end}. Skipping.`,
					);
					return;
				}
			}
		}

		// Step 3: Poll target wallets
		for (const wallet of sc.wallets) {
			logger.debug(
				`Polling trades for ${wallet.nickname} (${wallet.address})...`,
			);
			const trades = await copyTraderService.getWalletTrades(
				wallet.address,
			);
			if (trades.length === 0) continue;

			const lastTradeId = await redisService.getLastProcessedTradeId(
				wallet.address,
			);
			const botStartTime = await redisService.getBotStartTime();

			// If we never saw this wallet, just mark the latest trade as processed and move on
			if (!lastTradeId) {
				if (trades.length > 0) {
					await redisService.setLastProcessedTradeId(
						wallet.address,
						trades[0].id,
					);
				}
				continue;
			}

			// Find index of lastTradeId
			const lastIdx = trades.findIndex((t) => t.id === lastTradeId);
			let newTrades = lastIdx === -1 ? trades : trades.slice(0, lastIdx);

			// SAFETY: Only process trades that happened after the bot started
			if (botStartTime) {
				newTrades = newTrades.filter(
					(t) => t.timestamp * 1000 >= botStartTime - 5000,
				); // 5s buffer
			}

			if (newTrades.length > 0) {
				logger.info(
					`Found ${newTrades.length} new trade(s) for ${wallet.nickname}`,
				);
				// Process from oldest to newest
				for (const trade of [...newTrades].reverse()) {
					await this.processTargetTrade(trade, wallet.nickname, sc);
				}
				await redisService.setLastProcessedTradeId(
					wallet.address,
					trades[0].id,
				);
			}
		}
	}

	private async processTargetTrade(
		targetTrade: ClobTrade,
		nickname: string,
		sc: any,
	): Promise<void> {
		if (targetTrade.side === 'BUY') {
			await this.handleTargetBuy(targetTrade, nickname, sc);
		} else {
			await this.handleTargetSell(targetTrade, nickname);
		}
	}

	private async handleTargetBuy(
		targetTrade: ClobTrade,
		nickname: string,
		sc: any,
	): Promise<void> {
		const activeTrades = await redisService.getActiveTrades();
		
		// Check if we already have an active trade for this specific token from this specific wallet
		const alreadyIn = activeTrades.find(
			(t) => t.tokenId === targetTrade.asset && t.copyFrom === nickname
		);

		if (alreadyIn) {
			logger.debug(`Already in position for ${targetTrade.title} from ${nickname}. Skipping duplicate buy.`);
			return;
		}

		if (activeTrades.length >= sc.maxConcurrentTrades) {
			logger.warn(
				`Max concurrent trades reached. Skipping copy for ${nickname}`,
			);
			return;
		}

		// Fetch market details
		const market = await polymarketService.getMarketByConditionId(
			targetTrade.conditionId,
		);
		if (!market) {
			logger.warn(
				`Could not find market for condition ${targetTrade.conditionId}. Skipping.`,
			);
			return;
		}

		// Skip if market already ended
		if (new Date() >= market.endTime) {
			logger.warn(`Market already ended for ${market.title}. Skipping.`);
			return;
		}

		const direction =
			targetTrade.asset === market.upTokenId ? 'UP' : 'DOWN';
		const price = targetTrade.price;
		const orderBudget = sc.fixedOrderSizeUsd;
		const size = Math.max(
			config.minOrderSize,
			Math.floor(orderBudget / price),
		);

		logger.info(
			`🎯 Copying BUY from ${nickname}: ${market.title} | Side: ${direction} | Price: ${price}`,
		);

		if (config.isDemo) {
			const trade = await demoTradingService.placeBuyOrder(
				targetTrade.asset,
				price,
				size,
				market,
				direction,
				1.0, // Confidence 100% for copy trading
				{},
				nickname,
			);
			if (trade) {
				notificationManager.handleTradeOpened(trade);
			}
		} else {
			const botBalance = await redisService.getBotBalance(sc);
			if (orderBudget > botBalance) {
				logger.warn(
					`Insufficient balance: $${botBalance.toFixed(2)} available, need $${orderBudget.toFixed(2)}`,
				);
				return;
			}

			try {
				const order = await polymarketService.placeBuyOrder(
					targetTrade.asset,
					price,
					size,
					market,
				);

				if (order && parseFloat(order.size_matched || '0') > 0) {
					const filledPrice = parseFloat(order.price);
					const filledSize = parseFloat(order.size_matched || '0');
					const fee = calculateFee(filledSize, filledPrice);
					const cost = filledSize * filledPrice;

					const trade: Trade = {
						id: order.id,
						type: config.mode,
						direction,
						tokenId: targetTrade.asset,
						conditionId: market.conditionId,
						slug: market.slug,
						eventTicker: market.eventTicker,
						title: market.title,
						side: 'BUY',
						entryPrice: filledPrice,
						currentPrice: filledPrice,
						size: filledSize,
						cost,
						fee,
						status: TradeStatus.OPEN,
						startTime: market.startTime.toISOString(),
						endTime: market.endTime.toISOString(),
						enteredAt: new Date().toISOString(),
						pnl: 0,
						copyFrom: nickname,
					};

					await redisService.saveTrade(trade);
					notificationManager.handleTradeOpened(trade);
					await redisService.setBotBalance(botBalance - cost - fee);
				}
			} catch (error) {
				logger.error(`Failed to place live copy order: ${error}`);
			}
		}
	}

	private async handleTargetSell(
		targetTrade: ClobTrade,
		nickname: string,
	): Promise<void> {
		const activeTrades = await redisService.getActiveTrades();
		// Find all trades that match the token AND were copied from THIS wallet
		const matchingTrades = activeTrades.filter(
			(t) => t.tokenId === targetTrade.asset && t.copyFrom === nickname,
		);

		if (matchingTrades.length > 0) {
			logger.info(
				`🎯 Copying SELL from ${nickname}: Found ${matchingTrades.length} trade(s) to close.`,
			);

			for (const ourTrade of matchingTrades) {
				logger.info(`  → Closing trade: ${ourTrade.title} (${ourTrade.id})`);

				// Fetch market details
				const market = await polymarketService.getMarketByConditionId(
					ourTrade.conditionId,
				);
				if (!market) {
					logger.warn(
						`Could not fetch market for closing trade ${ourTrade.id}`,
					);
					continue;
				}

				const prices = await polymarketService.getMarketPrices(market);
				if (!prices) {
					logger.warn(
						`Could not fetch prices for closing trade ${ourTrade.id}`,
					);
					continue;
				}

				const sellPrice =
					ourTrade.direction === 'UP' ? prices.upPrice : prices.downPrice;

				if (config.isDemo) {
					await demoTradingService.closeTrade(
						ourTrade.id,
						sellPrice,
						TradeStatus.CLOSED_SELL,
					);
				} else {
					try {
						const order = await polymarketService.placeSellOrder(
							ourTrade.tokenId,
							sellPrice,
							ourTrade.size,
							market,
						);
						if (order) {
							// PnL and cleanup will be handled by resolveExpiredTrades or a dedicated monitor
							ourTrade.status = TradeStatus.CLOSED_SELL;
							ourTrade.exitPrice = parseFloat(order.price);
							ourTrade.closedAt = new Date().toISOString();

							// Calculate PnL
							const exitValue = ourTrade.size * ourTrade.exitPrice;
							const entryValue = ourTrade.cost;
							const fee = calculateFee(
								ourTrade.size,
								ourTrade.exitPrice,
							);
							ourTrade.pnl =
								exitValue - entryValue - ourTrade.fee - fee;

							await redisService.saveTrade(ourTrade);
							await redisService.moveToAwaitingResolve(ourTrade.id);

							// Update balance
							const currentBal = await redisService.getBotBalance();
							await redisService.setBotBalance(
								currentBal + exitValue - fee,
							);
						}
					} catch (error) {
						logger.error(
							`Failed to place live copy SELL order: ${error}`,
						);
					}
				}
			}
		}
	}

	private async resolveExpiredTrades(trades: Trade[]): Promise<void> {
		const now = new Date();
		for (const trade of trades) {
			if (
				trade.status !== TradeStatus.OPEN &&
				trade.status !== TradeStatus.AWAITING_RESOLVE
			)
				continue;

			const endTime = new Date(trade.endTime);
			if (now < endTime && trade.status === TradeStatus.OPEN) continue;

			if (trade.status === TradeStatus.AWAITING_RESOLVE) continue;

			const msSinceEnd = now.getTime() - endTime.getTime();
			if (msSinceEnd < 10000) continue;

			logger.info(`⏰ Resolving expired trade: ${trade.title}`);
			trade.status = TradeStatus.AWAITING_RESOLVE;
			await redisService.saveTrade(trade);
			await redisService.moveToAwaitingResolve(trade.id);

			await queueService.addResolveJob({ trade, type: 'RESOLVE' });
		}
	}

	private async cleanupWebSocketSubscriptions(
		market: Market | null,
		activeTrades: Trade[],
	): Promise<void> {
		// In copy trader, we might not need WS for discovery, but maybe for real-time prices
		// No-op for now or implement as needed
	}
}

const strategyEngine = new StrategyEngine();
export default strategyEngine;
