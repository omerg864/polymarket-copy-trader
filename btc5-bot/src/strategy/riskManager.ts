import { DateTime } from 'luxon';
import { type Trade } from '@shared/types';
import polymarketService from '../services/polymarket';
import priceAnalysisService from '../services/priceAnalysis';
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
	private fctInterval: ReturnType<typeof setInterval> | null = null;
	private checking = false;
	private checkingFct = false;
	private sellingTrades = new Set<string>();
	private SL_SEC_LEFT = 5;
	private DEMO_FCT_SEC_LEFT = 5;

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

				const endTime = DateTime.fromISO(trade.endTime);
				const now = DateTime.now();
				const secUntilEnd = endTime.diff(now).as('seconds');
				if (secUntilEnd > sc.maxSecLoseFct + fctBufferSec) continue; // skip if not in fct window

				const priceToBeat = parseFloat(String(trade.priceToBeat));
				if (!priceToBeat || priceToBeat <= 0) {
					logger.error(
						`Price to beat not available for trade ${trade.id} ${trade.direction}, skipping FCT check`,
					);
					continue;
				}
				try {
					const btcPrice =
						await priceAnalysisService.getCurrentPrice();
					if (!btcPrice) {
						logger.error(
							`BTC price not available, skipping FCT check for trade ${trade.id} ${trade.direction}`,
						);
						continue;
					}

					const resolvesUp =
						btcPrice >= priceToBeat - sc.fctBtcOffset;
					const wouldLose =
						(trade.direction === 'UP' && !resolvesUp) ||
						(trade.direction === 'DOWN' && resolvesUp);

					if (!wouldLose) continue;

					if (trade.type === 'demo') {
						if (secUntilEnd < this.DEMO_FCT_SEC_LEFT) {
							logger.info(
								`⏱️  FORCE CLOSE (${secUntilEnd.toFixed(1)}s left) | ${trade.id} ${trade.direction} but BTC $${(btcPrice || 0).toFixed(2)} vs ref $${priceToBeat.toFixed(2)} → resolves ${resolvesUp ? 'UP' : 'DOWN'}. CANNOT SELL WHEN LESS THAN ${this.DEMO_FCT_SEC_LEFT}S LEFT`,
							);
							continue;
						}
					}

					const currentPrice = await polymarketService.getTokenPrice(
						trade.tokenId,
						trade.conditionId,
						trade.direction,
					);
					if (currentPrice === null || currentPrice <= 0) continue;

					logger.info(
						`⏱️  FORCE CLOSE (${secUntilEnd.toFixed(0)}s left) | ${trade.id} ${trade.direction} but BTC $${(btcPrice || 0).toFixed(2)} vs ref $${priceToBeat.toFixed(2)} → resolves ${resolvesUp ? 'UP' : 'DOWN'}. Selling to avoid resolution loss.`,
					);
					await this.executeSell(
						trade,
						currentPrice,
						'fct',
						btcPrice,
					);
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

		const endTime = DateTime.fromISO(trade.endTime);
		const now = DateTime.now();
		if (now >= endTime) return;

		if (this.sellingTrades.has(trade.id)) return;

		const sc = await getStrategyConfig();

		const btcPrice = await priceAnalysisService.getCurrentPrice();

		const priceToBeat = parseFloat(String(trade.priceToBeat));
		if (!priceToBeat || priceToBeat <= 0) {
			logger.error(
				`Price to beat not available for trade ${trade.id} ${trade.direction}, skipping position check`,
			);
			return;
		}

		const currentPrice = await polymarketService.getTokenPrice(
			trade.tokenId,
			trade.conditionId,
			trade.direction,
		);

		if (currentPrice === null || currentPrice <= 0) {
			logger.error(
				`Current price not available for trade ${trade.id} ${trade.direction}, skipping position check`,
			);
			return;
		}

		const pctChange = (currentPrice - trade.entryPrice) / trade.entryPrice;

		// Update current price in trade
		trade.currentPrice = currentPrice;
		await redisService.saveTrade(trade);

		// Take profit check
		let isTakeProfit = false;
		let tpPrice = 0;

		if (sc.takeProfitType === 'market') {
			isTakeProfit = currentPrice >= sc.marketPriceTakeProfit;
			tpPrice = sc.marketPriceTakeProfit;
		} else {
			// Percentage based take profit
			const tpPct = sc.takeProfitPct / 100;
			tpPrice = trade.entryPrice * (1 + tpPct);
			isTakeProfit = currentPrice >= tpPrice;
		}

		if (isTakeProfit) {
			if (!btcPrice) {
				logger.error(
					`BTC price not available for trade ${trade.id}, using 0`,
				);
			}
			const tpInfo =
				sc.takeProfitType === 'market'
					? `Price: ${currentPrice.toFixed(3)} >= ${tpPrice.toFixed(2)}`
					: `Price: ${currentPrice.toFixed(3)} >= ${tpPrice.toFixed(3)} (+${sc.takeProfitPct}% TP)`;

			logger.info(
				`🟢 TAKE PROFIT triggered for ${trade.id} ${trade.direction} | ${tpInfo} | Entry: ${trade.entryPrice.toFixed(3)} | BTC: $${(btcPrice ?? 0).toFixed(2)}`,
			);
			try {
				await this.executeSell(
					trade,
					currentPrice,
					'tp',
					btcPrice ?? 0,
				);
			} catch (err) {
				logger.error(`Error executing sell: ${err}`);
			}
			return;
		}

		// Stop loss check
		let isStopLoss = false;
		let slPrice = 0;

		if (sc.stopLossType === 'market') {
			isStopLoss = currentPrice <= sc.marketPriceStopLoss;
			slPrice = sc.marketPriceStopLoss;
		} else {
			// Percentage based stop loss
			const slPct = sc.stopLossPct / 100;
			slPrice = trade.entryPrice * (1 - slPct);
			isStopLoss = currentPrice <= slPrice;
		}

		// NEW: Additional Late Stop-loss check (Last 5 seconds, more than 5% loss)
		const secUntilEnd = endTime.diff(now).as('seconds');
		if (secUntilEnd <= this.SL_SEC_LEFT) {
			const lossPct =
				(trade.entryPrice - currentPrice) / trade.entryPrice;
			if (lossPct > 0.05 && !isStopLoss) {
				logger.info(
					`🚨 LATE SL Triggered for ${trade.id} (${secUntilEnd.toFixed(1)}s left) | Loss: ${(lossPct * 100).toFixed(1)}% > 5%`,
				);
				isStopLoss = true;
				slPrice = currentPrice;
			}
		}

		if (isStopLoss) {
			if (!btcPrice) {
				logger.error(
					`BTC price not available for trade ${trade.id}, using 0`,
				);
			}
			const slInfo =
				sc.stopLossType === 'market'
					? `Price: ${currentPrice.toFixed(3)} <= ${slPrice.toFixed(2)}`
					: `Price: ${currentPrice.toFixed(3)} <= ${slPrice.toFixed(3)} (${sc.stopLossPct}% SL)`;

			logger.info(
				`🔴 STOP LOSS triggered for ${trade.id} ${trade.direction} | ${slInfo} | Entry: ${trade.entryPrice.toFixed(3)} | BTC: $${(btcPrice ?? 0).toFixed(2)}`,
			);
			try {
				await this.executeSell(
					trade,
					currentPrice,
					'sl',
					btcPrice ?? 0,
				);
			} catch (err) {
				logger.error(`Error executing sell: ${err}`);
			}
			return;
		}

		const emoji = pctChange >= 0 ? '📈' : '📉';
		logger.info(
			`${emoji} ${trade.id} ${trade.direction} | ${trade.entryPrice.toFixed(3)} → ${currentPrice.toFixed(3)} (${(pctChange * 100).toFixed(1)}%) | BTC: $${(btcPrice ?? 0).toFixed(2)} vs ref $${priceToBeat.toFixed(2)}`,
		);
	}

	private async executeSell(
		trade: Trade,
		currentPrice: number,
		reason: string = 'sell',
		btcPrice?: number,
	): Promise<void> {
		if (this.sellingTrades.has(trade.id)) {
			logger.warn(
				`⚠️  Skip executeSell for ${trade.id} - already in progress`,
			);
			return;
		}

		// Block selling if less than 5s left for demo trades
		const endTime = DateTime.fromISO(trade.endTime);
		const now = DateTime.now();
		const secUntilEnd = endTime.diff(now).as('seconds');

		if (trade.type === 'demo' && secUntilEnd < this.DEMO_FCT_SEC_LEFT - 1) {
			logger.warn(
				`🛑 DEMO SAFETY: Cannot sell ${trade.id} with only ${secUntilEnd.toFixed(1)}s left (simulating illiquidity)`,
			);
			return;
		}

		this.sellingTrades.add(trade.id);
		try {
			await queueService.addSellJob({
				trade,
				type: 'SELL_ORDER',
				exitPrice: currentPrice,
				btcPrice,
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
