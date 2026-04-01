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

		this.ws.on('message', (data: string) => {
			const message = data.toString();
			if (message === 'PONG') return; // Ignore heartbeat responses
			logger.debug(`Polymarket RTDS WebSocket message: ${message}`);
			try {
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
						// Keep at debug level to avoid spam but visible for investigation
						logger.debug(
							`Polymarket RTDS BTC price: $${value} (${parsed.payload.symbol})`,
						);
					}
				}
			} catch (err) {
				// Safely ignore non-JSON messages
				logger.error(`❌ Polymarket RTDS WebSocket error: ${err}`);
				this.stop();
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
				{ topic: 'crypto_prices', type: 'update' },
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
	 */
	public getLatestPrice(): number | null {
		if (!this.latestBtcPrice) return null;

		const freshnessMs = 2000;
		if (Date.now() - this.lastUpdateTimestamp > freshnessMs) {
			return null;
		}

		return this.latestBtcPrice;
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
