import { DateTime } from 'luxon';
import { TradeType, type Trade } from '@shared/types';
import polymarketService from '../services/polymarket';
import redisService from '../services/redis';
import { getStrategyConfig } from '../services/strategyConfig';
import queueService from '../services/queueService';
import logger from '../utils/logger';

/**
 * Risk manager — monitors active positions and triggers
 * take-profit or stop-loss exits mid-trade.
 */
class RiskManager {
	private monitoring = false;
	private monitorInterval: ReturnType<typeof setInterval> | null = null;
	private checking = false;
	private sellingTrades = new Set<string>();

	async startMonitoring(): Promise<void> {
		if (this.monitoring) return;
		this.monitoring = true;

		const sc = await getStrategyConfig();
		const interval = sc.riskMonitorIntervalMs || 500;
		this.monitorInterval = setInterval(
			() => this.checkAllPositions(),
			interval,
		);
		logger.info(
			`🛡️  Risk manager started — monitoring positions every ${interval}ms`,
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
			const trades = (await redisService.getActiveTrades()).filter(
				(trade) => new Date(trade.endTime).getTime() > Date.now(),
			);
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

		const endTime = DateTime.fromISO(trade.endTime);
		const now = DateTime.now();
		if (now >= endTime) return;

		if (this.sellingTrades.has(trade.id)) return;

		const sc = await getStrategyConfig();

		// For copy trading, we mainly use percentage based TP/SL as safeguards
		const market = await polymarketService.getMarketByConditionId(
			trade.conditionId,
		);
		if (!market) return;

		const prices = await polymarketService.getMarketPrices(market);
		if (!prices) return;

		const currentPrice =
			trade.direction === 'UP' ? prices.upPrice : prices.downPrice;
		if (currentPrice === null || currentPrice <= 0) return;

		const pctChange = (currentPrice - trade.entryPrice) / trade.entryPrice;

		// Update current price in trade
		trade.currentPrice = currentPrice;
		await redisService.saveTrade(trade);

		logger.debug(
			`🛡️  ${trade.id} ${trade.direction} | ${trade.entryPrice.toFixed(3)} → ${currentPrice.toFixed(3)} (${(pctChange * 100).toFixed(1)}%)`,
		);
	}

	private async executeSell(
		trade: Trade,
		currentPrice: number,
		reason: string = 'sell',
	): Promise<void> {
		if (this.sellingTrades.has(trade.id)) return;

		this.sellingTrades.add(trade.id);
		try {
			await queueService.addSellJob({
				trade,
				type: 'SELL_ORDER',
				exitPrice: currentPrice,
				reason,
			});
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			logger.error(`Error queuing sell: ${message}`);
			this.sellingTrades.delete(trade.id);
		}
	}
}

const riskManager = new RiskManager();
export default riskManager;
