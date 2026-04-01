import { WebSocket } from 'ws';
import logger from '../utils/logger';

/**
 * Service to connect to Polymarket's RTDS (Real-Time Data Socket)
 * for external crypto prices (BTC, etc).
 */
class PolymarketPriceWsService {
	private ws: WebSocket | null = null;
	private latestBtcPrice: number | null = null;
	private lastUpdateTimestamp: number = 0;

	private readonly baseUrl = 'wss://ws-live-data.polymarket.com';
	private isStarted = false;
	private isConnecting = false;
	private reconnectTimeoutMs = 1000;
	private readonly maxReconnectTimeoutMs = 30000;
	private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

	public async start(): Promise<void> {
		if (this.isStarted) return;
		this.isStarted = true;
		this.connect();
	}

	private connect(): void {
		if (!this.isStarted || this.isConnecting) return;
		this.isConnecting = true;

		logger.info(
			'🔌 Connecting to Polymarket RTDS WebSocket (Crypto Prices)',
		);
		this.ws = new WebSocket(this.baseUrl);

		this.ws.on('open', () => {
			logger.info('✅ Polymarket RTDS WebSocket connected');
			this.isConnecting = false;
			this.reconnectTimeoutMs = 1000;
			this.subscribe();
			this.startHeartbeat();
		});

		this.ws.on('message', (data: any) => {
			try {
				const message = data.toString();
				if (!message) {
					logger.debug('Polymarket RTDS received empty message');
					return;
				}
				if (message === 'PONG') return;

				logger.debug(`Polymarket RTDS WebSocket message: ${message}`);
				const parsed = JSON.parse(message);

				// Support both 'crypto_prices' and 'crypto_prices_chainlink'
				const isPriceTopic =
					parsed.topic === 'crypto_prices_chainlink' ||
					parsed.topic === 'crypto_prices';

				// Support 'btc/usd' (Chainlink) or 'btcusdt' (Binance source)
				const isBtcSymbol = parsed.payload?.symbol === 'btc/usd';

				if (isPriceTopic && isBtcSymbol) {
					const value = parsed.payload.value;
					if (typeof value === 'number') {
						this.latestBtcPrice = value;
						this.lastUpdateTimestamp = Date.now();
						logger.debug(
							`Polymarket RTDS BTC price: $${value} (${parsed.payload.symbol})`,
						);
					}
				}
			} catch (err) {
				const errMsg = err instanceof Error ? err.message : String(err);
				logger.error(`❌ Polymarket RTDS message handle error: ${errMsg}`);
				// DO NOT call this.stop() here as it kills the service on a single bad message
			}
		});

		this.ws.on('close', () => {
			this.stopHeartbeat();
			if (this.isStarted) {
				logger.warn(
					`⚠️ Polymarket RTDS WebSocket closed. Reconnecting in ${this.reconnectTimeoutMs}ms...`,
				);
				setTimeout(() => {
					if (!this.isStarted) return;
					this.reconnectTimeoutMs = Math.min(
						this.reconnectTimeoutMs * 2,
						this.maxReconnectTimeoutMs,
					);
					this.isConnecting = false;
					this.connect();
				}, this.reconnectTimeoutMs);
			}
		});

		this.ws.on('error', (err: Error) => {
			logger.error(`❌ Polymarket RTDS WebSocket error: ${err.message}`);
			this.isConnecting = false;
		});
	}

	private subscribe(): void {
		if (this.ws?.readyState === WebSocket.OPEN) {
			logger.info('📡 Subscribing to Polymarket BTC topic(s)');

			const subscriptions = [
				{ topic: 'crypto_prices_chainlink', type: 'update' },
			];

			this.ws.send(
				JSON.stringify({
					action: 'subscribe',
					subscriptions,
				}),
			);
		}
	}

	private startHeartbeat(): void {
		this.stopHeartbeat();
		this.heartbeatInterval = setInterval(() => {
			if (this.ws?.readyState === WebSocket.OPEN) {
				// User confirmed raw string 'PING'
				this.ws.send('PING');
			}
		}, 5000);
	}

	private stopHeartbeat(): void {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
			this.heartbeatInterval = null;
		}
	}

	/**
	 * Returns the latest BTC price if it's fresh (last 2 seconds).
	 * Also checks a watchdog: if no data for 30 seconds, it forces a reconnect.
	 */
	public getLatestPrice(): number | null {
		if (!this.latestBtcPrice || this.lastUpdateTimestamp === 0) return null;

		const now = Date.now();
		const ageMs = now - this.lastUpdateTimestamp;

		// Watchdog: If we haven't received a price in 30 seconds, the socket might be a "zombie".
		// We force a reconnect to try and restore the data flow.
		if (ageMs > 30000) {
			logger.warn(
				`🚨 No Polymarket BTC price received for 30s (last was ${ageMs / 1000}s ago). Force reconnecting...`,
			);
			this.forceReconnect();
			return null;
		}

		const freshnessMs = 2000;
		if (ageMs > freshnessMs) {
			// Transparently return null if slightly stale, but don't reconnect yet.
			// The caller (PriceAnalysisService) will handle the null.
			return null;
		}

		return this.latestBtcPrice;
	}

	/**
	 * Closes the current connection and triggers a fresh connect().
	 */
	private forceReconnect(): void {
		if (this.isConnecting && this.ws?.readyState === WebSocket.CONNECTING)
			return;

		logger.info('🔄 Forcing Polymarket RTDS reconnection...');
		this.isConnecting = false; // Reset to allow connect() to proceed
		if (this.ws) {
			this.ws.removeAllListeners();
			try {
				this.ws.terminate();
			} catch (e) {
				// ignore
			}
			this.ws = null;
		}
		this.stopHeartbeat();
		this.connect();
	}

	public stop(): void {
		this.isStarted = false;
		this.stopHeartbeat();
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		logger.info('🔌 Polymarket RTDS WebSocket service stopped');
	}
}

const polymarketPriceWsService = new PolymarketPriceWsService();
export default polymarketPriceWsService;
