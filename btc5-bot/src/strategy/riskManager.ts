import { calculateFee, type Trade } from '@shared/types';
import config from '../config';
import demoTradingService from '../services/demoTrading';
import polymarketService from '../services/polymarket';
import priceAnalysisService from '../services/priceAnalysis';
import redisService from '../services/redis';
import { getStrategyConfig } from '../services/strategyConfig';
import notificationManager from '../services/notificationManager';
import logger from '../utils/logger';

/**
 * Risk manager — monitors active positions and triggers
 * take-profit or stop-loss exits mid-trade.
 */
class RiskManager {
	private monitoring = false;
	private monitorInterval: ReturnType<typeof setInterval> | null = null;
	private fctInterval: ReturnType<typeof setInterval> | null = null;
	private checking = false;
	private checkingFct = false;
	private sellingTrades = new Set<string>();

	async startMonitoring(): Promise<void> {
		if (this.monitoring) return;
		this.monitoring = true;

		const sc = await getStrategyConfig();
		this.monitorInterval = setInterval(
			() => this.checkAllPositions(),
			sc.riskMonitorIntervalMs,
		);
		this.fctInterval = setInterval(() => this.checkFctPositions(), 1000);
		logger.info(
			`🛡️  Risk manager started — monitoring positions every ${sc.riskMonitorIntervalMs}ms, FCT every 1s`,
		);
	}

	stopMonitoring(): void {
		this.monitoring = false;
		if (this.monitorInterval) {
			clearInterval(this.monitorInterval);
			this.monitorInterval = null;
		}
		if (this.fctInterval) {
			clearInterval(this.fctInterval);
			this.fctInterval = null;
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
	 * Fast 1-second loop: force-close trades approaching market end.
	 */
	private async checkFctPositions(): Promise<void> {
		if (this.checkingFct) return;
		this.checkingFct = true;

		try {
			const trades = await redisService.getActiveTrades();
			if (trades.length === 0) return;

			const sc = await getStrategyConfig();
			const fctBufferSec = 5;

			for (const trade of trades) {
				if (trade.status !== 'open') continue;
				if (this.sellingTrades.has(trade.id)) continue;

				const endTime = new Date(trade.endTime);
				const now = new Date();
				if (now >= endTime) continue;

				const secUntilEnd = (endTime.getTime() - now.getTime()) / 1000;
				if (secUntilEnd > sc.maxSecLoseFct + fctBufferSec) continue;

				const priceToBeat = parseFloat(String(trade.priceToBeat));
				if (!priceToBeat || priceToBeat <= 0) continue;

				if (secUntilEnd > sc.maxSecLoseFct + fctBufferSec) continue;
				try {
					const btcPrice =
						await priceAnalysisService.getCurrentPrice();
					if (!btcPrice) continue;

					const resolvesUp = btcPrice >= priceToBeat;
					const wouldLose =
						(trade.direction === 'UP' && !resolvesUp) ||
						(trade.direction === 'DOWN' && resolvesUp);

					if (!wouldLose) continue;

					const currentPrice = await polymarketService.getTokenPrice(
						trade.tokenId,
						trade.conditionId,
						trade.direction,
					);
					if (!currentPrice || currentPrice <= 0) continue;

					logger.info(
						`⏱️  FORCE CLOSE (${secUntilEnd.toFixed(0)}s left) | ${trade.direction} but BTC $${btcPrice.toFixed(2)} vs ref $${priceToBeat.toFixed(2)} → resolves ${resolvesUp ? 'UP' : 'DOWN'}. Selling to avoid resolution loss.`,
					);
					await this.executeSell(trade, currentPrice, 'fct');
				} catch (err) {
					/* ignore */
					logger.error(`Error executing sell: ${err}`);
				}
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			logger.error(`FCT check error: ${message}`);
		} finally {
			this.checkingFct = false;
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

		if (this.sellingTrades.has(trade.id)) return;

		const sc = await getStrategyConfig();

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
		if (pctChange >= sc.takeProfitPct) {
			logger.info(
				`🟢 TAKE PROFIT triggered for ${trade.direction} | Position: ${trade.entryPrice.toFixed(3)} → ${currentPrice.toFixed(3)} (+${(pctChange * 100).toFixed(1)}%) | BTC: $${btcPrice.toFixed(2)}`,
			);
			try {
				await this.executeSell(trade, currentPrice, 'tp');
			} catch (err) {
				logger.error(`Error executing sell: ${err}`);
			}
			return;
		}

		// Stop loss check
		if (pctChange <= -sc.stopLossPct) {
			logger.info(
				`🔴 STOP LOSS triggered for ${trade.direction} | Position: ${trade.entryPrice.toFixed(3)} → ${currentPrice.toFixed(3)} (${(pctChange * 100).toFixed(1)}%) | BTC: $${btcPrice.toFixed(2)}`,
			);
			try {
				await this.executeSell(trade, currentPrice, 'sl');
			} catch (err) {
				logger.error(`Error executing sell: ${err}`);
			}
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
		if (this.sellingTrades.has(trade.id)) {
			logger.warn(
				`⚠️  Skip executeSell for ${trade.id} - already in progress`,
			);
			return;
		}

		this.sellingTrades.add(trade.id);
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
				const sellFee = calculateFee(trade.size, currentPrice);
				const totalFee = (trade.fee || 0) + sellFee;
				trade.pnl = revenue - trade.cost - totalFee;
				trade.fee = totalFee;
				trade.closedAt = new Date().toISOString();

				await redisService.removeTrade(trade.id);
				await redisService.saveTradeHistory(trade);
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

				// Trigger notification via centralized manager
				await notificationManager.handleTradeClosed(trade, stats);
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			logger.error(`Error executing sell: ${message}`);
		} finally {
			this.sellingTrades.delete(trade.id);
		}
	}
}

const riskManager = new RiskManager();
export default riskManager;
