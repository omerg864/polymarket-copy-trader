import config from '../config.js';
import logger from '../utils/logger.js';
import demoTradingService from '../services/demoTrading.js';
import redisService from '../services/redis.js';
import priceAnalysisService from '../services/priceAnalysis.js';
import polymarketService from '../services/polymarket.js';

/**
 * Risk manager — monitors active positions and triggers
 * take-profit or stop-loss exits mid-trade.
 *
 * For demo mode, estimates position value using current BTC price
 * relative to priceToBeat. If BTC moves strongly in the trade's
 * direction, the position's implied price rises (toward 1.0),
 * triggering take-profit. If it moves against, it drops (toward 0.0),
 * triggering stop-loss.
 */
class RiskManager {
	constructor() {
		this.monitoring = false;
		this.monitorInterval = null;
		this.checking = false;
	}

	startMonitoring() {
		if (this.monitoring) return;
		this.monitoring = true;

		this.monitorInterval = setInterval(
			() => this.checkAllPositions(),
			config.riskMonitorIntervalMs,
		);
		logger.info(
			`🛡️  Risk manager started — monitoring positions every ${config.riskMonitorIntervalMs}ms`,
		);
	}

	stopMonitoring() {
		this.monitoring = false;
		if (this.monitorInterval) {
			clearInterval(this.monitorInterval);
			this.monitorInterval = null;
		}
		logger.info('Risk manager stopped');
	}

	async checkAllPositions() {
		if (this.checking) return;
		this.checking = true;

		try {
			const trades = await redisService.getActiveTrades();
			if (trades.length === 0) return;

			for (const trade of trades) {
				await this.checkPosition(trade);
			}
		} catch (error) {
			logger.error(`Risk manager error: ${error.message}`);
		} finally {
			this.checking = false;
		}
	}

	/**
	 * Check a single position against TP/SL thresholds.
	 * Uses BTC price vs priceToBeat to estimate position value.
	 */
	async checkPosition(trade) {
		if (trade.status !== 'open') return;

		// Check if market has ended — let the engine resolve
		const endTime = new Date(trade.endTime);
		const now = new Date();

		if (now >= endTime) {
			// Already logged by engine — suppress spammy repeated messages
			return;
		}

		// Get the priceToBeat from the trade
		const priceToBeat = parseFloat(trade.priceToBeat);
		if (!priceToBeat || priceToBeat <= 0) return;

		const btcPrice = await priceAnalysisService.getCurrentPrice();
		if (!btcPrice) return;

		// Get the real market price of our token from Polymarket
		const currentPrice = await polymarketService.getTokenPrice(
			trade.tokenId,
			trade.conditionId,
			trade.direction,
		);

		if (!currentPrice || currentPrice <= 0) return;

		const pctChange = (currentPrice - trade.entryPrice) / trade.entryPrice;

		// Update current price in trade
		trade.currentPrice = currentPrice;
		await redisService.saveTrade(trade);

		// Take profit check
		if (pctChange >= config.takeProfitPct) {
			logger.info(
				`🟢 TAKE PROFIT triggered for ${trade.direction} | Position: ${trade.entryPrice.toFixed(3)} → ${currentPrice.toFixed(3)} (+${(pctChange * 100).toFixed(1)}%) | BTC: $${btcPrice.toFixed(2)}`,
			);
			await this.executeSell(trade, currentPrice, 'tp');
			return;
		}

		// Stop loss check
		if (pctChange <= -config.stopLossPct) {
			logger.info(
				`🔴 STOP LOSS triggered for ${trade.direction} | Position: ${trade.entryPrice.toFixed(3)} → ${currentPrice.toFixed(3)} (${(pctChange * 100).toFixed(1)}%) | BTC: $${btcPrice.toFixed(2)}`,
			);
			await this.executeSell(trade, currentPrice, 'sl');
			return;
		}

		// Debug log position status
		const emoji = pctChange >= 0 ? '📈' : '📉';
		logger.debug(
			`${emoji} ${trade.direction} | ${trade.entryPrice.toFixed(3)} → ${currentPrice.toFixed(3)} (${(pctChange * 100).toFixed(1)}%) | BTC: $${btcPrice.toFixed(2)} vs ref $${priceToBeat.toFixed(2)}`,
		);
	}

	async executeSell(trade, currentPrice, reason = 'sell') {
		try {
			if (config.isDemo) {
				await demoTradingService.placeSellOrder(
					trade,
					currentPrice,
					reason,
				);
			} else {
				// For live mode — would place actual sell order
				const market = {
					conditionId: trade.conditionId,
					tickSize: config.tickSize,
					negRisk: config.negRisk,
				};
				const polymarketService = (
					await import('../services/polymarket.js')
				).default;
				await polymarketService.placeSellOrder(
					trade.tokenId,
					currentPrice,
					trade.size,
					market,
				);

				trade.status = 'closed_sell';
				trade.exitPrice = currentPrice;
				const revenue = currentPrice * trade.size;
				trade.pnl = revenue - trade.cost;
				trade.closedAt = new Date().toISOString();

				await redisService.removeTrade(trade.id);
				await redisService.saveTradeHistory(trade);

				// Update bot balance allowance for live mode
				const bal = await redisService.getBotBalance();
				await redisService.setBotBalance(bal + revenue);

				// Update virtual bot stats
				const stats = await redisService.getBotStats();
				stats.totalTrades += 1;
				if (trade.pnl >= 0) stats.wins += 1;
				else stats.losses += 1;
				stats.totalPnl += trade.pnl;
				await redisService.updateBotStats(stats);
			}
		} catch (error) {
			logger.error(`Error executing sell: ${error.message}`);
		}
	}
}

const riskManager = new RiskManager();
export default riskManager;
