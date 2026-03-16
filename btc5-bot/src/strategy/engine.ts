import { TradeStatus, TradeType, type Trade } from '@shared/types';
import { DateTime } from 'luxon';
import { calculateFee, calculateTodayPnl } from '@shared/utils';
import config from '../config';
import demoTradingService from '../services/demoTrading';
import notificationManager from '../services/notificationManager';
import polymarketService from '../services/polymarket';
import priceAnalysisService from '../services/priceAnalysis';
import queueService from '../services/queueService';
import redisService from '../services/redis';
import { getStrategyConfig } from '../services/strategyConfig';
import logger from '../utils/logger';
import riskManager from './riskManager';

/**
 * Strategy Engine — Core trading loop:
 * 1. Discover next upcoming 5-minute market
 * 2. Analyze BTC price for direction signal
 * 3. Place buy order on predicted outcome
 * 4. Monitor position for TP/SL or let ride to resolution
 * 5. Repeat
 */
class StrategyEngine {
	private running = false;
	private loopTimer: ReturnType<typeof setTimeout> | null = null;

	async start(): Promise<void> {
		this.running = true;
		const sc = await getStrategyConfig();
		logger.info('');
		logger.info('═══════════════════════════════════════════════');
		logger.info('  🤖 Polymarket BTC 5-Min Trading Bot Started');
		logger.info(
			`  Mode: ${config.isDemo ? '🎮 DEMO (paper trading)' : '💰 LIVE (real money)'}`,
		);
		logger.info('  Strategy: RSI + EMA + MACD momentum');
		logger.info(
			`  Order Size: $${sc.minOrderSizeUsd}-$${sc.maxOrderSizeUsd} (dynamic) | TP: ${sc.takeProfitPct * 100}% | SL: ${sc.stopLossPct * 100}%`,
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

	/**
	 * Schedule the next cycle after a delay.
	 * Uses chained setTimeout to guarantee only one cycle runs at a time.
	 */
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

	/**
	 * Single execution cycle
	 */
	private async executeCycle(): Promise<void> {
		// Fetch strategy config from Redis (cached locally for 10s)
		const sc = await getStrategyConfig();

		// Update BTC price in Redis for dashboard (ref price updated separately)
		try {
			const btcPrice = await priceAnalysisService.getCurrentPrice();
			if (btcPrice) {
				await redisService.setBtcPrice(btcPrice);
			}
		} catch (_) {
			/* ignore */
		}

		// Step 0: Check graceful stop
		const isStopping = await redisService.isStopRequested();

		// Step 1: Resolve any expired trades first
		const activeTrades = await redisService.getActiveTrades();
		await this.resolveExpiredTrades(activeTrades);

		// Re-fetch active trades after resolution
		const currentTrades = await redisService.getActiveTrades();

		if (isStopping) {
			logger.info('⏸️ Bot paused. Not entering new trades.');
			if (currentTrades.length > 0) {
				logger.info(
					`📋 Monitoring ${currentTrades.length} active trade(s)...`,
				);
			}
			return;
		}

		if (currentTrades.length >= sc.maxConcurrentTrades) {
			logger.info(
				`📋 Max concurrent trades reached (${currentTrades.length}/${sc.maxConcurrentTrades}). Waiting...`,
			);
			return;
		}

		// Step 2: Check for daily TP/SL limits (Optimized via Redis)
		const dailyStop = await redisService.getDailyStop();
		const todayStr = DateTime.now().setZone('Asia/Jerusalem').toISODate();

		if (dailyStop && dailyStop.stopped && dailyStop.date === todayStr) {
			// No new trades today
			return;
		}

		// Reset daily stop if date changed
		if (dailyStop && dailyStop.date !== todayStr) {
			await redisService.setDailyStop(false, todayStr || '');
		}

		// Step 3: Discover next market
		logger.info('🔍 Searching for next BTC 5-minute market...');
		const market = await polymarketService.getNextMarket();

		if (!market) {
			logger.info(
				'📭 No upcoming markets found. Markets may be between sessions.',
			);
			return;
		}

		// Check if we already have a trade on this market
		const existingTrade = activeTrades.find(
			(t) => t.conditionId === market.conditionId,
		);
		if (existingTrade) {
			logger.info(
				`📋 Already have a trade on ${market.title}. Monitoring...`,
			);
			return;
		}

		let now = new Date();
		const startTime = new Date(market.startTime);
		const endTime = new Date(market.endTime);
		const msUntilStart = startTime.getTime() - now.getTime();
		const msUntilEnd = endTime.getTime() - now.getTime();

		logger.info(`📅 Found market: ${market.title}`);
		logger.info(
			`   Start: ${startTime.toLocaleTimeString()} | End: ${endTime.toLocaleTimeString()}`,
		);

		// Wait for market to actually start
		if (msUntilStart > 0) {
			if (market.priceToBeat) {
				logger.info(
					`   BTC Reference Price: $${market.priceToBeat.toFixed(2)}`,
				);
			}
			logger.info(
				`   ⏳ Market starts in ${(msUntilStart / 1000).toFixed(0)}s. Waiting for it to open...`,
			);
			return;
		}

		// Skip if market is about to end
		const minMsRemaining = sc.minSecondsRemaining * 1000;
		if (msUntilEnd < minMsRemaining) {
			logger.info(
				`   ⏩ Market ends in ${(msUntilEnd / 1000).toFixed(0)}s. Threshold is ${(minMsRemaining / 1000).toFixed(0)}s. Skipping.`,
			);
			return;
		}

		// Step 4: Get priceToBeat
		const refPrice = market.priceToBeat;

		if (!refPrice) {
			logger.info(
				'   ⏳ Reference price (priceToBeat) not available in market data yet. Waiting...',
			);
			return;
		}

		// Update ref price in Redis for dashboard (only when resolved)
		await redisService.setPriceToBeat(refPrice, market.title);

		// Step 5: Analyze BTC price for signal
		logger.info(
			`📊 Analyzing BTC price vs reference $${refPrice.toFixed(2)}...`,
		);
		const signal = await priceAnalysisService.getSignal(refPrice);

		if (signal.confidence < sc.confidenceThreshold) {
			logger.info(
				`⚠️  Low confidence (${(signal.confidence * 100).toFixed(1)}% < ${sc.confidenceThreshold * 100}%). Skipping.`,
			);
			return;
		}

		// Guard: BTC Price must be on the "right side" of priceToBeat + offset
		const btcPrice = signal.indicators?.currentPrice;
		if (btcPrice != null) {
			const offset = sc.btcPriceOffset || 0;
			const isRightSide =
				signal.direction === 'UP'
					? btcPrice >= refPrice + offset
					: btcPrice <= refPrice - offset;

			if (!isRightSide) {
				const threshold =
					signal.direction === 'UP'
						? refPrice + offset
						: refPrice - offset;
				logger.info(
					`⚠️  BTC price on wrong side for ${signal.direction} (BTC: ${btcPrice.toFixed(2)}, Ref: ${refPrice.toFixed(2)}, Offset: ${offset}, Threshold: ${threshold.toFixed(2)}). Skipping trade.`,
				);
				return;
			}
		}

		// Step 6: Get market prices
		const prices = await polymarketService.getMarketPrices(market);
		logger.info(
			`   Market prices — Up: ${prices.upPrice.toFixed(3)} | Down: ${prices.downPrice.toFixed(3)}`,
		);

		// Step 7: Determine trade parameters
		const direction = signal.direction;
		const tokenId =
			direction === 'UP' ? market.upTokenId : market.downTokenId;
		const price = direction === 'UP' ? prices.upPrice : prices.downPrice;

		// Guard: Minimum Entry Price
		if (price < sc.minEntryPrice) {
			logger.info(
				`⚠️  Price too low ($${price.toFixed(3)} < $${sc.minEntryPrice.toFixed(2)}). Skipping trade.`,
			);
			return;
		}

		// Guard: Maximum Price to Open
		if (price > sc.maxEntryPrice) {
			logger.info(
				`⚠️  Price too high ($${price.toFixed(3)} > $${sc.maxEntryPrice.toFixed(2)}). Skipping trade.`,
			);
			return;
		}

		// Guard: Minimum Market Age
		now = new Date();
		const marketAgeMinutes =
			(now.getTime() - market.startTime.getTime()) / (1000 * 60);
		if (marketAgeMinutes < sc.minMarketAgeMinutes) {
			logger.info(
				`⏳ Market too young (${marketAgeMinutes.toFixed(1)}m < ${sc.minMarketAgeMinutes}m). Skipping trade.`,
			);
			return;
		}

		// Guard: StochRSI Range
		if (signal.indicators?.stochRsi) {
			const stochVal = parseFloat(signal.indicators.stochRsi);
			if (
				!isNaN(stochVal) &&
				(stochVal < sc.minStochRSI || stochVal > sc.maxStochRSI)
			) {
				logger.info(
					`⚠️  StochRSI ${stochVal.toFixed(1)} outside range [${sc.minStochRSI}, ${sc.maxStochRSI}]. Skipping trade.`,
				);
				return;
			}
		}

		// Guard: RSI-14 Range
		if (signal.indicators?.rsi14) {
			const rsi14Val = parseFloat(signal.indicators.rsi14);
			if (
				!isNaN(rsi14Val) &&
				(rsi14Val < sc.minRSI14 || rsi14Val > sc.maxRSI14)
			) {
				logger.info(
					`⚠️  RSI-14 ${rsi14Val.toFixed(1)} outside range [${sc.minRSI14}, ${sc.maxRSI14}]. Skipping trade.`,
				);
				return;
			}
		}

		// Guard: BB Position Range
		if (signal.indicators?.bbPosition) {
			const bbPosVal = parseFloat(signal.indicators.bbPosition);
			if (
				!isNaN(bbPosVal) &&
				(bbPosVal < sc.minBBPosition || bbPosVal > sc.maxBBPosition)
			) {
				logger.info(
					`⚠️  BB Position ${bbPosVal.toFixed(1)}% outside range [${sc.minBBPosition}, ${sc.maxBBPosition}]. Skipping trade.`,
				);
				return;
			}
		}

		// Validate price
		if (!price || price <= 0 || price >= 1 || !isFinite(price)) {
			logger.warn(
				`⚠️  Invalid price ${price} for ${direction}. Skipping trade.`,
			);
			return;
		}

		// Calculate dynamic order size
		const confidenceRange = 1.0 - sc.confidenceThreshold;
		const confidenceRatio =
			confidenceRange > 0
				? (signal.confidence - sc.confidenceThreshold) / confidenceRange
				: 0;
		const orderBudgetBase =
			sc.minOrderSizeUsd +
			confidenceRatio * (sc.maxOrderSizeUsd - sc.minOrderSizeUsd);
		// High price sizing bonus
		let orderBudget = orderBudgetBase;
		let multiplier = 1.0;

		if (price >= sc.highPriceThreshold) {
			const range = 1.0 - sc.highPriceThreshold;
			const progress = (price - sc.highPriceThreshold) / range;
			multiplier = 1.0 + progress * sc.highPriceMaxBonusPct;
			orderBudget = orderBudgetBase * multiplier;
		}

		const size = Math.max(
			config.minOrderSize,
			Math.floor(orderBudget / price),
		);

		if (multiplier > 1.0) {
			logger.info(
				`🔥 High price bonus: x${multiplier.toFixed(2)} multiplier applied (Price: ${price.toFixed(3)})`,
			);
		}

		logger.info(
			`🎯 Decision: BUY ${direction} @ ${price.toFixed(3)} | Confidence: ${(signal.confidence * 100).toFixed(1)}% → $${orderBudget.toFixed(2)} | Size: ${size} shares`,
		);

		// Step 8: Place the trade
		if (config.isDemo) {
			const trade = await demoTradingService.placeBuyOrder(
				tokenId,
				price,
				size,
				market,
				direction,
				signal.confidence,
				signal.indicators,
			);
			if (!trade) {
				logger.warn('Demo trade failed (likely insufficient balance)');
			}
		} else {
			const botBalance = await redisService.getBotBalance(sc);
			if (orderBudget > botBalance) {
				logger.warn(
					`⚠️  Insufficient bot allowance: $${botBalance.toFixed(2)} available, but trade size requires $${orderBudget.toFixed(2)}. Skipping live trade.`,
				);
				return;
			}

			try {
				const order = await polymarketService.placeBuyOrder(
					tokenId,
					price,
					size,
					market,
				);
				if (order) {
					const orderRecord = order as Record<string, unknown>;
					const fee = calculateFee(size, price);
					const trade: Trade = {
						id:
							(orderRecord.orderID as string) ||
							`live-${Date.now()}`,
						type: TradeType.LIVE,
						direction,
						tokenId,
						conditionId: market.conditionId,
						slug: market.slug,
						eventTicker: market.eventTicker,
						title: market.title,
						side: 'BUY',
						entryPrice: price,
						currentPrice: price,
						size,
						cost: price * size,
						fee,
						status: TradeStatus.OPEN,
						startTime: market.startTime.toISOString(),
						endTime: market.endTime.toISOString(),
						enteredAt: new Date().toISOString(),
						priceToBeat: market.priceToBeat ?? 0,
						pnl: 0,
						indicators: signal.indicators,
					};
					await redisService.saveTrade(trade);
					await redisService.setBotBalance(
						botBalance - trade.cost - fee,
					);
				}
			} catch (error) {
				const message =
					error instanceof Error ? error.message : String(error);
				logger.error(`Failed to place live order: ${message}`);
			}
		}

		// Print stats periodically
		const stats = await redisService.getBotStats();
		if (stats.totalTrades > 0 && stats.totalTrades % 5 === 0) {
			if (config.isDemo) {
				await demoTradingService.printStats();
			} else {
				const bal = await redisService.getBotBalance(sc);
				logger.info(
					`📊 LIVE STATS | Bot Allowance Used: $${bal.toFixed(2)} / $${sc.botAllowance.toFixed(2)} | Trades: ${stats.totalTrades} | Win: ${stats.wins} | Loss: ${stats.losses}`,
				);
			}
		}
	}

	/**
	 * Resolve trades whose markets have ended
	 */
	private async resolveExpiredTrades(trades: Trade[]): Promise<void> {
		const now = new Date();

		for (const trade of trades) {
			if (trade.status !== 'open') continue;

			const endTime = new Date(trade.endTime);
			if (now < endTime) continue;

			const msSinceEnd = now.getTime() - endTime.getTime();
			if (msSinceEnd < 30000) continue;

			logger.info(`⏰ Resolving expired trade: ${trade.title}`);
			const btcPrice = await priceAnalysisService.getCurrentPrice();

			// Offload resolution to BullMQ
			await queueService.addSellJob({
				trade,
				type: 'RESOLVE',
				btcPrice: btcPrice ?? undefined,
			});
		}
	}
}

const strategyEngine = new StrategyEngine();
export default strategyEngine;
