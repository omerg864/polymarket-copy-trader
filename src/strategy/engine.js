import config from '../config.js';
import logger from '../utils/logger.js';
import polymarketService from '../services/polymarket.js';
import priceAnalysisService from '../services/priceAnalysis.js';
import demoTradingService from '../services/demoTrading.js';
import redisService from '../services/redis.js';
import riskManager from './riskManager.js';

/**
 * Strategy Engine — Core trading loop:
 * 1. Discover next upcoming 5-minute market
 * 2. Analyze BTC price for direction signal
 * 3. Place buy order on predicted outcome
 * 4. Monitor position for TP/SL or let ride to resolution
 * 5. Repeat
 */
class StrategyEngine {
	constructor() {
		this.running = false;
		this.cycleRunning = false;
		this.currentMarket = null;
		this.loopTimer = null;
	}

	async start() {
		this.running = true;
		logger.info('');
		logger.info('═══════════════════════════════════════════════');
		logger.info('  🤖 Polymarket BTC 5-Min Trading Bot Started');
		logger.info(
			`  Mode: ${config.isDemo ? '🎮 DEMO (paper trading)' : '💰 LIVE (real money)'}`,
		);
		logger.info(`  Strategy: RSI + EMA + MACD momentum`);
		logger.info(
			`  Order Size: $${config.minOrderSizeUsd}-$${config.maxOrderSizeUsd} (dynamic) | TP: ${config.takeProfitPct * 100}% | SL: ${config.stopLossPct * 100}%`,
		);
		logger.info('═══════════════════════════════════════════════');
		logger.info('');

		// Start risk manager
		riskManager.startMonitoring();

		// Start the first cycle (subsequent ones are scheduled via chained setTimeout)
		this.scheduleNextCycle(0);
	}

	async stop() {
		this.running = false;
		riskManager.stopMonitoring();
		if (this.loopTimer) {
			clearTimeout(this.loopTimer);
			this.loopTimer = null;
		}

		// Print final stats in demo mode
		if (config.isDemo) {
			await demoTradingService.printStats();
		}

		logger.info('🛑 Trading bot stopped');
	}

	/**
	 * Schedule the next cycle after a delay.
	 * Uses chained setTimeout to guarantee only one cycle runs at a time.
	 */
	scheduleNextCycle(delayMs) {
		if (!this.running) return;
		this.loopTimer = setTimeout(async () => {
			try {
				await this.executeCycle();
			} catch (error) {
				logger.error(`Strategy cycle error: ${error.message}`);
				logger.error(error.stack);
			}
			// Schedule next cycle AFTER this one completes (15s polling)
			this.scheduleNextCycle(15000);
		}, delayMs);
	}

	/**
	 * Single execution cycle
	 */
	async executeCycle() {
		// Step 0: Check graceful stop
		const isStopping = await redisService.isStopRequested();

		// Step 1: Resolve any expired trades first (must happen BEFORE max trades check)
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

		if (currentTrades.length >= config.maxConcurrentTrades) {
			logger.info(
				`📋 Max concurrent trades reached (${currentTrades.length}/${config.maxConcurrentTrades}). Waiting...`,
			);
			return;
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

		// Wait for market to actually start before trying to get priceToBeat
		if (msUntilStart > 0) {
			if (market.priceToBeat) {
				logger.info(
					`   BTC Reference Price: $${parseFloat(market.priceToBeat).toFixed(2)}`,
				);
			}
			logger.info(
				`   ⏳ Market starts in ${(msUntilStart / 1000).toFixed(0)}s. Waiting for it to open...`,
			);
			return;
		}

		// Skip if market is about to end (< 60s remaining)
		if (msUntilEnd < 60000) {
			logger.info(
				`   ⏩ Market ends in ${(msUntilEnd / 1000).toFixed(0)}s. Too late to enter. Skipping.`,
			);
			return;
		}

		// Step 4: Get priceToBeat (reference price)
		let refPrice = market.priceToBeat
			? parseFloat(market.priceToBeat)
			: null;

		if (!refPrice) {
			logger.info(
				'   ⏳ Fetching reference price from Binance for market start time...',
			);
			refPrice = await priceAnalysisService.getHistoricalPrice(
				market.startTime.getTime(),
			);

			if (refPrice) {
				market.priceToBeat = refPrice;
				logger.info(
					`   ✅ Extracted reference price from Binance: $${refPrice.toFixed(2)}`,
				);
			}
		}

		// If priceToBeat is still missing, skip this cycle
		if (!refPrice) {
			logger.info(
				'   ⚠️  Reference price not available yet. Will retry next cycle.',
			);
			return;
		}

		// Step 5: Analyze BTC price for signal
		logger.info(
			`📊 Analyzing BTC price vs reference $${refPrice.toFixed(2)}...`,
		);
		const signal = await priceAnalysisService.getSignal(refPrice);

		// Check confidence threshold
		if (signal.confidence < config.confidenceThreshold) {
			logger.info(
				`⚠️  Low confidence (${(signal.confidence * 100).toFixed(1)}% < ${config.confidenceThreshold * 100}%). Skipping.`,
			);
			return;
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
		if (price < config.minEntryPrice) {
			logger.info(
				`⚠️  Price too low ($${price.toFixed(3)} < $${config.minEntryPrice.toFixed(2)}). Skipping trade.`,
			);
			return;
		}

		// Guard: Minimum Market Age
		now = new Date();
		const marketAgeMinutes =
			(now.getTime() - market.startTime.getTime()) / (1000 * 60);
		if (marketAgeMinutes < config.minMarketAgeMinutes) {
			logger.info(
				`⏳ Market too young (${marketAgeMinutes.toFixed(1)}m < ${config.minMarketAgeMinutes}m). Skipping trade.`,
			);
			return;
		}

		// Validate price — skip if zero or invalid
		if (!price || price <= 0 || price >= 1 || !isFinite(price)) {
			logger.warn(
				`⚠️  Invalid price ${price} for ${direction}. Skipping trade.`,
			);
			return;
		}

		// Calculate dynamic order size based on confidence
		const confidenceRange = 1.0 - config.confidenceThreshold;
		const confidenceRatio =
			confidenceRange > 0
				? (signal.confidence - config.confidenceThreshold) /
					confidenceRange
				: 0;
		const orderBudgetBase =
			config.minOrderSizeUsd +
			confidenceRatio * (config.maxOrderSizeUsd - config.minOrderSizeUsd);

		// High price sizing bonus logic
		let orderBudget = orderBudgetBase;
		let multiplier = 1.0;

		if (price >= config.highPriceThreshold) {
			const range = 1.0 - config.highPriceThreshold;
			const progress = (price - config.highPriceThreshold) / range;
			multiplier = 1.0 + progress * config.highPriceMaxBonusPct;
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
			);
			if (!trade) {
				logger.warn('Demo trade failed (likely insufficient balance)');
			}
		} else {
			// Live Mode Limit Check
			const botBalance = await redisService.getBotBalance();
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
					// Save trade to Redis for monitoring
					const trade = {
						id: order.orderID || `live-${Date.now()}`,
						type: 'live',
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
						status: 'open',
						startTime: market.startTime.toISOString(),
						endTime: market.endTime.toISOString(),
						enteredAt: new Date().toISOString(),
						orderId: order.orderID,
						priceToBeat: market.priceToBeat,
						pnl: 0,
					};
					await redisService.saveTrade(trade);

					// Deduct cost from virtual allowance
					await redisService.setBotBalance(botBalance - trade.cost);
				}
			} catch (error) {
				logger.error(`Failed to place live order: ${error.message}`);
			}
		}

		// Print stats periodically
		const stats = await redisService.getBotStats();
		if (stats.totalTrades > 0 && stats.totalTrades % 5 === 0) {
			if (config.isDemo) {
				await demoTradingService.printStats();
			} else {
				const bal = await redisService.getBotBalance();
				logger.info(
					`📊 LIVE STATS | Bot Allowance Used: $${bal.toFixed(2)} / $${config.botAllowance.toFixed(2)} | Trades: ${stats.totalTrades} | Win: ${stats.wins} | Loss: ${stats.losses}`,
				);
			}
		}
	}

	/**
	 * Resolve trades whose markets have ended
	 */
	async resolveExpiredTrades(trades) {
		const now = new Date();

		for (const trade of trades) {
			if (trade.status !== 'open') continue;

			const endTime = new Date(trade.endTime);
			if (now < endTime) continue;

			// Wait a bit after market end for Polymarket to resolve (at least 30s)
			const msSinceEnd = now.getTime() - endTime.getTime();
			if (msSinceEnd < 30000) continue;

			// Market has ended — get actual outcome from Polymarket API
			logger.info(`⏰ Resolving expired trade: ${trade.title}`);

			const winner = await polymarketService.getMarketOutcome(
				trade.eventTicker,
			);

			if (!winner) {
				// Not resolved yet on Polymarket — will retry next cycle
				logger.info(
					`   ⏳ Market not yet resolved on Polymarket. Will check again.`,
				);
				continue;
			}

			const won = trade.direction === winner;

			if (config.isDemo) {
				await demoTradingService.resolveTrade(trade, won);
			} else {
				trade.status = 'resolved';
				trade.outcome = winner;
				trade.won = won;
				trade.closedAt = new Date().toISOString();

				const finalPrice = won ? 1.0 : 0.0;
				const revenue = finalPrice * trade.size;
				trade.pnl = revenue - trade.cost;

				await redisService.removeTrade(trade.id);
				await redisService.saveTradeHistory(trade);

				// Update live allowance
				const bal = await redisService.getBotBalance();
				await redisService.setBotBalance(bal + revenue);

				// Update live stats
				const stats = await redisService.getBotStats();
				stats.totalTrades += 1;
				if (trade.pnl >= 0) stats.wins += 1;
				else stats.losses += 1;
				stats.totalPnl += trade.pnl;
				await redisService.updateBotStats(stats);

				logger.trade('Trade resolved (on-chain)', {
					id: trade.id,
					outcome: winner,
					won,
				});
			}
		}
	}
}

const strategyEngine = new StrategyEngine();
export default strategyEngine;
