import type { Trade } from '@shared/types';
import config from '../config';
import demoTradingService from '../services/demoTrading';
import polymarketService from '../services/polymarket';
import priceAnalysisService from '../services/priceAnalysis';
import redisService from '../services/redis';
import logger from '../utils/logger';

/**
 * Risk manager — monitors active positions and triggers
 * take-profit or stop-loss exits mid-trade.
 */
class RiskManager {
	private monitoring = false;
	private monitorInterval: ReturnType<typeof setInterval> | null = null;
	private checking = false;

	startMonitoring(): void {
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

	stopMonitoring(): void {
		this.monitoring = false;
		if (this.monitorInterval) {
			clearInterval(this.monitorInterval);
			this.monitorInterval = null;
		}
		logger.info('Risk manager stopped');
	}

	private async checkAllPositions(): Promise<void> {
		if (this.checking) return;
		this.checking = true;

		try {
			const trades = await redisService.getActiveTrades();
			if (trades.length === 0) return;

			for (const trade of trades) {
				await this.checkPosition(trade);
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			logger.error(`Risk manager error: ${message}`);
		} finally {
			this.checking = false;
		}
	}

	/**
	 * Check a single position against TP/SL thresholds.
	 */
	private async checkPosition(trade: Trade): Promise<void> {
		if (trade.status !== 'open') return;

		const endTime = new Date(trade.endTime);
		const now = new Date();
		if (now >= endTime) return;

		const priceToBeat = parseFloat(String(trade.priceToBeat));
		if (!priceToBeat || priceToBeat <= 0) return;

		const btcPrice = await priceAnalysisService.getCurrentPrice();
		if (!btcPrice) return;

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

		const emoji = pctChange >= 0 ? '📈' : '📉';
		logger.debug(
			`${emoji} ${trade.direction} | ${trade.entryPrice.toFixed(3)} → ${currentPrice.toFixed(3)} (${(pctChange * 100).toFixed(1)}%) | BTC: $${btcPrice.toFixed(2)} vs ref $${priceToBeat.toFixed(2)}`,
		);
	}

	private async executeSell(
		trade: Trade,
		currentPrice: number,
		reason: string = 'sell',
	): Promise<void> {
		try {
			if (config.isDemo) {
				await demoTradingService.placeSellOrder(
					trade,
					currentPrice,
					reason,
				);
			} else {
				const market = {
					conditionId: trade.conditionId,
					tickSize: config.tickSize,
					negRisk: config.negRisk,
				};
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

				const bal = await redisService.getBotBalance();
				await redisService.setBotBalance(bal + revenue);

				const stats = await redisService.getBotStats();
				stats.totalTrades += 1;
				if (trade.pnl >= 0) stats.wins += 1;
				else stats.losses += 1;
				stats.totalPnl += trade.pnl;
				await redisService.updateBotStats(stats);
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			logger.error(`Error executing sell: ${message}`);
		}
	}
}

const riskManager = new RiskManager();
export default riskManager;
