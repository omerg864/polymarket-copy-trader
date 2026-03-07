import axios from 'axios';
import {
	RSI,
	EMA,
	BollingerBands,
	StochasticRSI,
	VWAP,
} from 'technicalindicators';
import config from '../config.js';
import logger from '../utils/logger.js';

class PriceAnalysisService {
	constructor() {
		this.binanceApi = axios.create({
			baseURL: 'https://api.binance.com/api/v3',
			timeout: 10000,
		});
	}

	/**
	 * Fetch 1-minute OHLCV candles from Binance
	 */
	async getCandles(limit = config.candleCount) {
		try {
			const response = await this.binanceApi.get('/klines', {
				params: {
					symbol: 'BTCUSDT',
					interval: '1m',
					limit,
				},
			});

			return response.data.map((candle) => ({
				openTime: candle[0],
				open: parseFloat(candle[1]),
				high: parseFloat(candle[2]),
				low: parseFloat(candle[3]),
				close: parseFloat(candle[4]),
				volume: parseFloat(candle[5]),
				closeTime: candle[6],
			}));
		} catch (error) {
			logger.error(`Error fetching candles: ${error.message}`);
			return [];
		}
	}

	/**
	 * Get current BTC price
	 */
	async getCurrentPrice() {
		try {
			const response = await this.binanceApi.get('/ticker/price', {
				params: { symbol: 'BTCUSDT' },
			});
			return parseFloat(response.data.price);
		} catch (error) {
			logger.error(`Error fetching BTC price: ${error.message}`);
			return null;
		}
	}

	/**
	 * Get historical BTC price at an exact start time
	 */
	async getHistoricalPrice(startTimeMs) {
		try {
			const response = await this.binanceApi.get('/klines', {
				params: {
					symbol: 'BTCUSDT',
					interval: '1m',
					startTime: startTimeMs,
					limit: 1,
				},
			});
			if (response.data && response.data[0]) {
				// Index 1 is the open price of the 1m candle
				return parseFloat(response.data[0][1]);
			}
			return null;
		} catch (error) {
			logger.error(
				`Error fetching historical BTC price: ${error.message}`,
			);
			return null;
		}
	}

	/**
	 * Generate a trading signal for a 5-minute binary market.
	 *
	 * These markets resolve based on whether BTC finishes ABOVE or BELOW
	 * a specific reference price (priceToBeat). The strategy must be
	 * reference-price-aware, not just "bullish/bearish".
	 *
	 * @param {number|null} priceToBeat - The reference price (null if unavailable)
	 * @returns {{ direction: 'UP'|'DOWN', confidence: number, indicators: object }}
	 */
	async getSignal(priceToBeat = null) {
		const candles = await this.getCandles();
		if (candles.length < 20) {
			logger.warn('Not enough candle data for signal generation');
			return { direction: 'UP', confidence: 0.3, indicators: {} };
		}

		const closes = candles.map((c) => c.close);
		const currentPrice = closes[closes.length - 1];

		// === Indicator calculations ===

		// Micro-RSI (period 5) — fast reaction to overbought/oversold
		const rsiValues = RSI.calculate({ values: closes, period: 5 });
		const microRsi =
			rsiValues.length > 0 ? rsiValues[rsiValues.length - 1] : 50;

		// Standard RSI for context
		const rsi14Values = RSI.calculate({ values: closes, period: 14 });
		const rsi14 =
			rsi14Values.length > 0 ? rsi14Values[rsi14Values.length - 1] : 50;

		// Stochastic RSI (period 14) — extremely sensitive momentum
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

		// VWAP — Volume Weighted Average Price
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

		// Short-term EMA (3 vs 8) for micro-trend
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

		// Bollinger Bands (period 10, tighter for 1-min)
		const bbValues = BollingerBands.calculate({
			period: 10,
			values: closes,
			stdDev: 2,
		});
		const bb = bbValues.length > 0 ? bbValues[bbValues.length - 1] : null;

		// Short-term momentum (last 3 candles)
		const recent3 = closes.slice(-3);
		const momentum3 =
			recent3.length >= 2
				? (recent3[recent3.length - 1] - recent3[0]) / recent3[0]
				: 0;

		// Volatility — standard deviation of last 10 closes
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

		// --- Factor 1: Distance from priceToBeat (weight: 4) ---
		// This is the MOST important factor for binary markets
		if (priceToBeat && priceToBeat > 0) {
			const distPct = (currentPrice - priceToBeat) / priceToBeat;
			maxScore += 4;

			if (distPct > 0.001) {
				// BTC is significantly above reference → UP likely
				bullScore += distPct > 0.003 ? 4 : 3;
			} else if (distPct < -0.001) {
				// BTC is significantly below reference → DOWN likely
				bearScore += distPct < -0.003 ? 4 : 3;
			} else {
				// Too close to call — add 1 to whichever micro-trend favors
				if (momentum3 > 0) bullScore += 1;
				else bearScore += 1;
			}
		}

		// --- Factor 2: Short-term momentum (weight: 3) ---
		maxScore += 3;
		if (momentum3 > 0.0005) {
			bullScore += 3; // Strong upward micro-momentum
		} else if (momentum3 > 0.0001) {
			bullScore += 2;
		} else if (momentum3 < -0.0005) {
			bearScore += 3; // Strong downward micro-momentum
		} else if (momentum3 < -0.0001) {
			bearScore += 2;
		} else {
			// Nearly flat
			if (momentum3 > 0) bullScore += 1;
			else bearScore += 1;
		}

		// --- Factor 3: Micro-RSI (weight: 2) ---
		maxScore += 2;
		if (microRsi < 25) {
			bullScore += 2; // Very oversold → bounce likely
		} else if (microRsi < 40) {
			bullScore += 1; // Slightly oversold
		} else if (microRsi > 75) {
			bearScore += 2; // Very overbought → drop likely
		} else if (microRsi > 60) {
			bearScore += 1; // Slightly overbought
		}

		// --- Factor 4: EMA micro-trend (weight: 2) ---
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

		// --- Factor 5: VWAP (Volume alignment) (weight: 2) ---
		maxScore += 2;
		if (currentPrice > vwap) {
			// Price above VWAP = bulls in control
			bullScore += currentPrice > vwap * 1.0005 ? 2 : 1;
		} else if (currentPrice < vwap) {
			// Price below VWAP = bears in control
			bearScore += currentPrice < vwap * 0.9995 ? 2 : 1;
		}

		// --- Factor 6: StochRSI (weight: 2) ---
		maxScore += 2;
		if (stochRsi.k < 20 && stochRsi.d < 20) {
			bullScore += 2; // Deeply oversold
		} else if (stochRsi.k < 40) {
			bullScore += 1;
		} else if (stochRsi.k > 80 && stochRsi.d > 80) {
			bearScore += 2; // Deeply overbought
		} else if (stochRsi.k > 60) {
			bearScore += 1;
		}

		// --- Factor 7: Bollinger Band Breakout/Reversion (weight: 2) ---
		if (bb) {
			maxScore += 2;
			if (currentPrice < bb.lower) {
				bullScore += 2; // Pierced lower band → strong mean reversion up
			} else if (currentPrice <= bb.lower * 1.0002) {
				bullScore += 1; // Near lower band
			} else if (currentPrice > bb.upper) {
				bearScore += 2; // Pierced upper band → strong mean reversion down
			} else if (currentPrice >= bb.upper * 0.9998) {
				bearScore += 1; // Near upper band
			}
		}

		// === Confidence & Direction ===
		const totalScore = bullScore + bearScore;
		const direction = bullScore >= bearScore ? 'UP' : 'DOWN';
		const winningScore = Math.max(bullScore, bearScore);

		// Base confidence from scoring
		let confidence = totalScore > 0 ? winningScore / totalScore : 0.5;

		// Volatility penalty — high volatility = less predictable
		if (volatilityPct > 0.002) {
			confidence *= 0.8; // 20% confidence penalty for high volatility
		} else if (volatilityPct > 0.001) {
			confidence *= 0.9; // 10% penalty for moderate volatility
		}

		// Distance bonus — if price is far from priceToBeat, more confident
		if (priceToBeat && priceToBeat > 0) {
			const absDistPct = Math.abs(
				(currentPrice - priceToBeat) / priceToBeat,
			);
			if (absDistPct > 0.005) {
				confidence = Math.min(1, confidence * 1.15);
			}
		}

		// Edge case: if no priceToBeat available, reduce confidence significantly
		if (!priceToBeat || priceToBeat <= 0) {
			confidence *= 0.7;
		}

		const signal = {
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
				bbUpper: bb ? bb.upper.toFixed(2) : 'N/A',
				momentum3: (momentum3 * 100).toFixed(4) + '%',
				volatility: (volatilityPct * 100).toFixed(4) + '%',
			},
		};

		const emoji = direction === 'UP' ? '🟢' : '🔴';
		logger.info(
			JSON.stringify({
				indicators: {
					btcPrice: currentPrice.toFixed(2),
					priceToBeat: priceToBeat ? priceToBeat.toFixed(2) : 'N/A',
					distFromRef: signal.indicators.distFromRef,
					vwap: signal.indicators.vwap,
					microRsi: microRsi.toFixed(2),
					stochRsi: signal.indicators.stochRsi,
					momentum3: signal.indicators.momentum3,
				},
			}) +
				` ${emoji} [SIGNAL] ${direction} (confidence: ${(confidence * 100).toFixed(1)}%)`,
		);

		return signal;
	}
}

const priceAnalysisService = new PriceAnalysisService();
export default priceAnalysisService;
