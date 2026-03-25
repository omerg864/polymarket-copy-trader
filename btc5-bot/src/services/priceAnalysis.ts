import type { Candle, Signal } from '@shared/types';
import axios, { AxiosInstance } from 'axios';
import {
	BollingerBands,
	EMA,
	RSI,
	StochasticRSI,
	VWAP,
} from 'technicalindicators';
import logger from '../utils/logger';
import { getStrategyConfig } from './strategyConfig';
import NotificationManager from './notificationManager';
import binanceWsService from './binanceWs';

class PriceAnalysisService {
	private binanceApi: AxiosInstance;

	constructor() {
		this.binanceApi = axios.create({
			baseURL: 'https://api.binance.com/api/v3',
			timeout: 10000,
		});
	}

	/**
	 * Fetch 1-minute OHLCV candles from Binance
	 */
	async getCandles(limit?: number): Promise<Candle[]> {
		const sc = await getStrategyConfig();
		const count = limit ?? sc.candleCount;
		
		const wsCandles = binanceWsService.getCandles(count);
		if (wsCandles.length >= count) {
			return wsCandles;
		}

		try {
			// Fallback to REST if WebSocket buffer is not ready
			const response = await this.binanceApi.get<unknown[][]>('/klines', {
				params: {
					symbol: 'BTCUSDT',
					interval: '1m',
					limit: count,
				},
			});

			logger.debug(`Candles fetched via REST fallback (WS buffer only has ${wsCandles.length}/${count})`);
			return response.data.map((candle) => ({
				openTime: candle[0] as number,
				open: parseFloat(candle[1] as string),
				high: parseFloat(candle[2] as string),
				low: parseFloat(candle[3] as string),
				close: parseFloat(candle[4] as string),
				volume: parseFloat(candle[5] as string),
				closeTime: candle[6] as number,
			}));
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			logger.error(`Error fetching candles: ${message}`);
			NotificationManager.handleError(
				error,
				'PriceAnalysis',
				'getCandles',
			);
			return [];
		}
	}

	/**
	 * Get current BTC price
	 */
	async getCurrentPrice(): Promise<number | null> {
		const wsPrice = binanceWsService.getCurrentPrice();
		if (wsPrice !== null) {
			return wsPrice;
		}

		try {
			// Fallback to REST if WebSocket price is unavailable
			const response = await this.binanceApi.get<{ price: string }>(
				'/ticker/price',
				{
					params: { symbol: 'BTCUSDT' },
				},
			);
			const price = parseFloat(response.data.price);
			logger.debug(`BTC price fetched via REST fallback: $${price.toFixed(2)}`);
			return price;
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			logger.error(`Error fetching BTC price: ${message}`);
			NotificationManager.handleError(
				error,
				'PriceAnalysis',
				'getCurrentPrice',
			);
			return null;
		}
	}

	/**
	 * Get historical BTC price at an exact start time
	 */
	async getHistoricalPrice(startTimeMs: number): Promise<number | null> {
		try {
			const response = await this.binanceApi.get<unknown[][]>('/klines', {
				params: {
					symbol: 'BTCUSDT',
					interval: '1m',
					startTime: startTimeMs,
					limit: 1,
				},
			});
			if (response.data && response.data[0]) {
				return parseFloat(response.data[0][1] as string);
			}
			return null;
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			logger.error(`Error fetching historical BTC price: ${message}`);
			return null;
		}
	}

	/**
	 * Generate a trading signal for a 5-minute binary market.
	 */
	async getSignal(
		priceToBeat: number | null = null,
		market?: any,
	): Promise<Signal> {
		const candles = await this.getCandles();
		if (candles.length < 20) {
			logger.warn('Not enough candle data for signal generation');
			return { direction: 'UP', confidence: 0.3, indicators: undefined };
		}

		const closes = candles.map((c) => c.close);
		const currentPrice = closes[closes.length - 1];

		// === Indicator calculations ===

		// Micro-RSI (period 5)
		const rsiValues = RSI.calculate({ values: closes, period: 5 });
		const microRsi =
			rsiValues.length > 0 ? rsiValues[rsiValues.length - 1] : 50;

		// Standard RSI
		const rsi14Values = RSI.calculate({ values: closes, period: 14 });
		const rsi14 =
			rsi14Values.length > 0 ? rsi14Values[rsi14Values.length - 1] : 50;

		// Stochastic RSI
		const stochRsiValues = StochasticRSI.calculate({
			values: closes,
			rsiPeriod: 14,
			stochasticPeriod: 14,
			kPeriod: 3,
			dPeriod: 3,
		});
		const stochRsi =
			stochRsiValues.length > 0
				? stochRsiValues[stochRsiValues.length - 1]
				: { k: 50, d: 50 };

		// VWAP
		const vwapValues = VWAP.calculate({
			high: candles.map((c) => c.high),
			low: candles.map((c) => c.low),
			close: closes,
			volume: candles.map((c) => c.volume),
		});
		const vwap =
			vwapValues.length > 0
				? vwapValues[vwapValues.length - 1]
				: currentPrice;

		// Short-term EMA (3 vs 8)
		const ema3Values = EMA.calculate({ values: closes, period: 3 });
		const ema8Values = EMA.calculate({ values: closes, period: 8 });
		const ema3 =
			ema3Values.length > 0
				? ema3Values[ema3Values.length - 1]
				: currentPrice;
		const ema8 =
			ema8Values.length > 0
				? ema8Values[ema8Values.length - 1]
				: currentPrice;

		// Bollinger Bands
		const bbValues = BollingerBands.calculate({
			period: 10,
			values: closes,
			stdDev: 2,
		});
		const bb = bbValues.length > 0 ? bbValues[bbValues.length - 1] : null;

		// Short-term momentum
		const recent3 = closes.slice(-3);
		const momentum3 =
			recent3.length >= 2
				? (recent3[recent3.length - 1] - recent3[0]) / recent3[0]
				: 0;

		// Volatility
		const recent10 = closes.slice(-10);
		const mean10 = recent10.reduce((a, b) => a + b, 0) / recent10.length;
		const stdDev = Math.sqrt(
			recent10.reduce((sum, v) => sum + (v - mean10) ** 2, 0) /
				recent10.length,
		);
		const volatilityPct = mean10 > 0 ? stdDev / mean10 : 0;

		// === Scoring ===
		let bullScore = 0;
		let bearScore = 0;
		let maxScore = 0;

		// Factor 1: Distance from priceToBeat (weight: 4)
		if (priceToBeat && priceToBeat > 0) {
			const distPct = (currentPrice - priceToBeat) / priceToBeat;
			maxScore += 4;

			if (distPct > 0.001) {
				bullScore += distPct > 0.003 ? 4 : 3;
			} else if (distPct < -0.001) {
				bearScore += distPct < -0.003 ? 4 : 3;
			} else {
				if (momentum3 > 0) bullScore += 1;
				else bearScore += 1;
			}
		}

		// Factor 2: Short-term momentum (weight: 3)
		maxScore += 3;
		if (momentum3 > 0.0005) {
			bullScore += 3;
		} else if (momentum3 > 0.0001) {
			bullScore += 2;
		} else if (momentum3 < -0.0005) {
			bearScore += 3;
		} else if (momentum3 < -0.0001) {
			bearScore += 2;
		} else {
			if (momentum3 > 0) bullScore += 1;
			else bearScore += 1;
		}

		// Factor 3: Micro-RSI (weight: 2)
		maxScore += 2;
		if (microRsi < 25) {
			bullScore += 2;
		} else if (microRsi < 40) {
			bullScore += 1;
		} else if (microRsi > 75) {
			bearScore += 2;
		} else if (microRsi > 60) {
			bearScore += 1;
		}

		// Factor 4: EMA micro-trend (weight: 2)
		maxScore += 2;
		const emaDiff = (ema3 - ema8) / ema8;
		if (emaDiff > 0.0002) {
			bullScore += 2;
		} else if (emaDiff > 0) {
			bullScore += 1;
		} else if (emaDiff < -0.0002) {
			bearScore += 2;
		} else {
			bearScore += 1;
		}

		// Factor 5: VWAP (weight: 2)
		maxScore += 2;
		if (currentPrice > vwap) {
			bullScore += currentPrice > vwap * 1.0005 ? 2 : 1;
		} else if (currentPrice < vwap) {
			bearScore += currentPrice < vwap * 0.9995 ? 2 : 1;
		}

		// Factor 6: StochRSI (weight: 2)
		maxScore += 2;
		if (stochRsi.k < 20 && stochRsi.d < 20) {
			bullScore += 2;
		} else if (stochRsi.k < 40) {
			bullScore += 1;
		} else if (stochRsi.k > 80 && stochRsi.d > 80) {
			bearScore += 2;
		} else if (stochRsi.k > 60) {
			bearScore += 1;
		}

		// Factor 7: Bollinger Band (weight: 2)
		if (bb) {
			maxScore += 2;
			if (currentPrice < bb.lower) {
				bullScore += 2;
			} else if (currentPrice <= bb.lower * 1.0002) {
				bullScore += 1;
			} else if (currentPrice > bb.upper) {
				bearScore += 2;
			} else if (currentPrice >= bb.upper * 0.9998) {
				bearScore += 1;
			}
		}

		// === Confidence & Direction ===
		const totalScore = bullScore + bearScore;
		const direction: 'UP' | 'DOWN' = bullScore >= bearScore ? 'UP' : 'DOWN';
		const winningScore = Math.max(bullScore, bearScore);

		let confidence = totalScore > 0 ? winningScore / totalScore : 0.5;

		// Volatility penalty
		if (volatilityPct > 0.002) {
			confidence *= 0.8;
		} else if (volatilityPct > 0.001) {
			confidence *= 0.9;
		}

		// Distance bonus
		if (priceToBeat && priceToBeat > 0) {
			const absDistPct = Math.abs(
				(currentPrice - priceToBeat) / priceToBeat,
			);
			if (absDistPct > 0.005) {
				confidence = Math.min(1, confidence * 1.15);
			}
		}

		// No priceToBeat penalty
		if (!priceToBeat || priceToBeat <= 0) {
			confidence *= 0.7;
		}

		const sc = await getStrategyConfig();
		const rsi14Pass = rsi14 >= sc.minRSI14 && rsi14 <= sc.maxRSI14;
		const stochRsiPass = stochRsi.k >= sc.minStochRSI && stochRsi.k <= sc.maxStochRSI;
		
		let bbPositionPass = true;
		let bbPositionVal = 0;
		if (bb && bb.upper !== bb.lower) {
			bbPositionVal = ((currentPrice - bb.lower) / (bb.upper - bb.lower)) * 100;
			bbPositionPass = bbPositionVal >= sc.minBBPosition && bbPositionVal <= sc.maxBBPosition;
		}

		// Entry Price Pass (BTC vs refPrice + offset)
		let entryPricePass = true;
		if (priceToBeat != null) {
			const offset = sc.btcPriceOffset || 0;
			const threshold =
				direction === 'UP' ? priceToBeat + offset : priceToBeat - offset;
			entryPricePass =
				direction === 'UP'
					? currentPrice >= threshold
					: currentPrice <= threshold;
		}

		// Market Price Pass
		let marketPricePass = true;
		if (market) {
			const mPrice =
				direction === 'UP' ? market.upPrice || 0 : market.downPrice || 0;
			marketPricePass =
				mPrice >= sc.minEntryPrice && mPrice <= sc.maxEntryPrice;
		}

		// Time Frame Pass (Formatted as M:SS)
		let timeFramePass = true;
		let timeRemaining = 'N/A';
		if (market && market.endTime) {
			const msUntilEnd =
				new Date(market.endTime).getTime() - Date.now();
			const totalSeconds = Math.max(0, Math.floor(msUntilEnd / 1000));
			const minutes = Math.floor(totalSeconds / 60);
			const seconds = totalSeconds % 60;
			timeRemaining = `${minutes}:${seconds.toString().padStart(2, '0')}`;
			timeFramePass = totalSeconds >= (sc.minSecondsRemaining || 0);
		}

		const signal: Signal = {
			direction,
			confidence,
			indicators: {
				currentPrice,
				priceToBeat: priceToBeat || 'N/A',
				distFromRef: priceToBeat
					? (
							((currentPrice - priceToBeat) / priceToBeat) *
							100
						).toFixed(4) + '%'
					: 'N/A',
				vwap: vwap.toFixed(2),
				microRsi: microRsi.toFixed(1),
				stochRsi: stochRsi.k.toFixed(1),
				rsi14: rsi14.toFixed(1),
				ema3: ema3.toFixed(2),
				ema8: ema8.toFixed(2),
				bbLower: bb ? bb.lower.toFixed(2) : 'N/A',
				bbMiddle: bb ? bb.middle.toFixed(2) : 'N/A',
				bbUpper: bb ? bb.upper.toFixed(2) : 'N/A',
				bbPosition:
					bb && bb.upper !== bb.lower
						? bbPositionVal.toFixed(1) + '%'
						: 'N/A',
				momentum3: (momentum3 * 100).toFixed(4) + '%',
				volatility: (volatilityPct * 100).toFixed(4) + '%',
				rsi14Pass,
				stochRsiPass,
				bbPositionPass,
				entryPricePass,
				marketPricePass,
				timeFramePass,
				timeRemaining,
			},
		};

		const emoji = direction === 'UP' ? '🟢' : '🔴';
		logger.info(
			JSON.stringify({
				indicators: {
					btcPrice: currentPrice.toFixed(2),
					priceToBeat: priceToBeat ? priceToBeat.toFixed(2) : 'N/A',
					distFromRef: signal.indicators?.distFromRef,
					vwap: signal.indicators?.vwap,
					microRsi: microRsi.toFixed(2),
					stochRsi: signal.indicators?.stochRsi,
					momentum3: signal.indicators?.momentum3,
				},
			}) +
				` ${emoji} [SIGNAL] ${direction} (confidence: ${(confidence * 100).toFixed(1)}%)`,
		);

		return signal;
	}
}

const priceAnalysisService = new PriceAnalysisService();
export default priceAnalysisService;
