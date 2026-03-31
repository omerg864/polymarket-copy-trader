import { WebSocket } from 'ws';
import axios from 'axios';
import type { Candle } from '@shared/types';
import logger from '../utils/logger';
import redisService from './redis';

class BinanceWsService {
	private ws: WebSocket | null = null;
	private currentPrice: number | null = null;
	private candleBuffer: Candle[] = [];
	private readonly maxBufferSize = 500;

	// Multi-stream URL format: stream?streams=stream1/stream2...
	private readonly baseUrl =
		'wss://stream.binance.com:9443/stream?streams=btcusdt@ticker/btcusdt@kline_1m';
	private readonly restUrl = 'https://api.binance.com/api/v3/klines';

	private reconnectTimeoutMs = 1000;
	private readonly maxReconnectTimeoutMs = 30000;
	private isStarted = false;
	private lastRedisUpdateTime = 0;
	private readonly redisThrottleMs = 1000;

	async start(): Promise<void> {
		if (this.isStarted) return;
		this.isStarted = true;

		// Prime the buffer before connecting WS
		await this.primeCandles();
		this.connect();
	}

	private async primeCandles(): Promise<void> {
		try {
			logger.info('🕯️ Priming candle buffer via REST...');
			const response = await axios.get<any[][]>(this.restUrl, {
				params: {
					symbol: 'BTCUSDT',
					interval: '1m',
					limit: 200, // Enough for all standard indicators
				},
			});

			this.candleBuffer = response.data.map((c) => ({
				openTime: c[0] as number,
				open: parseFloat(c[1] as string),
				high: parseFloat(c[2] as string),
				low: parseFloat(c[3] as string),
				close: parseFloat(c[4] as string),
				volume: parseFloat(c[5] as string),
				closeTime: c[6] as number,
			}));

			logger.info(`✅ Primed ${this.candleBuffer.length} candles`);
		} catch (err) {
			logger.error(`❌ Error priming candles: ${err}`);
		}
	}

	private connect(): void {
		if (!this.isStarted) return;

		logger.info(`🔌 Connecting to Binance WebSocket (Multi-Stream)`);
		this.ws = new WebSocket(this.baseUrl);

		this.ws.on('open', () => {
			logger.info('✅ Binance WebSocket connected');
			this.reconnectTimeoutMs = 1000;
		});

		this.ws.on('message', async (data: string) => {
			try {
				const msg = JSON.parse(data);
				const { stream, data: streamData } = msg;

				if (stream === 'btcusdt@ticker') {
					this.handleTicker(streamData);
				} else if (stream === 'btcusdt@kline_1m') {
					this.handleKline(streamData);
				}
			} catch (err) {
				logger.error(`Error parsing Binance WS message: ${err}`);
			}
		});

		this.ws.on('close', () => {
			if (this.isStarted) {
				logger.warn(
					`⚠️ Binance WebSocket closed. Reconnecting in ${this.reconnectTimeoutMs}ms...`,
				);
				setTimeout(() => {
					if (!this.isStarted) return;
					this.reconnectTimeoutMs = Math.min(
						this.reconnectTimeoutMs * 2,
						this.maxReconnectTimeoutMs,
					);
					this.connect();
				}, this.reconnectTimeoutMs);
			}
		});

		this.ws.on('error', (err: Error) => {
			logger.error(`❌ Binance WebSocket error: ${err.message}`);
		});
	}

	private async handleTicker(ticker: any): Promise<void> {
		const price = parseFloat(ticker.c);
		if (!isNaN(price)) {
			this.currentPrice = price;

			const now = Date.now();
			if (now - this.lastRedisUpdateTime > this.redisThrottleMs) {
				this.lastRedisUpdateTime = now;
				this.currentPrice = price;
			}
		}
	}

	private handleKline(klineData: any): void {
		const k = klineData.k;
		const candle: Candle = {
			openTime: k.t,
			open: parseFloat(k.o),
			high: parseFloat(k.h),
			low: parseFloat(k.l),
			close: parseFloat(k.c),
			volume: parseFloat(k.v),
			closeTime: k.T,
		};

		// If the kline is for the same openTime as our last candle, update it
		if (
			this.candleBuffer.length > 0 &&
			this.candleBuffer[this.candleBuffer.length - 1].openTime ===
				candle.openTime
		) {
			this.candleBuffer[this.candleBuffer.length - 1] = candle;
		} else {
			// New candle started
			this.candleBuffer.push(candle);
			// Maintain buffer size
			if (this.candleBuffer.length > this.maxBufferSize) {
				this.candleBuffer.shift();
			}
		}
	}

	public getCurrentPrice(): number | null {
		return this.currentPrice;
	}

	public getCandles(limit: number = 100): Candle[] {
		// If buffer is too small, return nothing (PriceAnalysis will fallback to REST)
		if (this.candleBuffer.length < limit) {
			return [];
		}
		return this.candleBuffer.slice(-limit);
	}

	public stop(): void {
		this.isStarted = false;
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		logger.info('🔌 Binance WebSocket service stopped');
	}
}

const binanceWsService = new BinanceWsService();
export default binanceWsService;
