import { WebSocket } from 'ws';
import logger from '../utils/logger';

interface WsPrice {
	midpoint: number;
	bestBid: number;
	bestAsk: number;
	timestamp: number;
}

class PolymarketWsService {
	private ws: WebSocket | null = null;
	private prices: Map<string, WsPrice> = new Map();
	private subscribedTokens: Set<string> = new Set();

	private readonly baseUrl =
		'wss://ws-subscriptions-clob.polymarket.com/ws/market';
	private reconnectTimeoutMs = 1000;
	private skipReconnectTimeout = false;
	private readonly maxReconnectTimeoutMs = 30000;
	private isStarted = false;
	private readonly dataFreshnessMs = 5000; // 5 seconds

	public async start(): Promise<void> {
		if (this.isStarted) return;
		this.isStarted = true;
		this.connect();
	}

	private connect(): void {
		if (!this.isStarted) return;

		logger.info('🔌 Connecting to Polymarket CLOB WebSocket');
		this.ws = new WebSocket(this.baseUrl);

		this.ws.on('open', () => {
			logger.info('✅ Polymarket WebSocket connected');
			this.reconnectTimeoutMs = 1000;
			this.resubscribe();
		});

		this.ws.on('message', (data: string) => {
			try {
				const msg = JSON.parse(data.toString());
				const events = Array.isArray(msg) ? msg : [msg];

				for (const e of events) {
					// We look for 'book' topic or price_changes
					if (e.topic === 'book' || e.price_changes) {
						const changes = e.price_changes || [e];
						for (const change of changes) {
							const assetId = change.asset_id;
							if (assetId) {
								const bid = change.best_bid
									? parseFloat(change.best_bid)
									: null;
								const ask = change.best_ask
									? parseFloat(change.best_ask)
									: null;

								if (bid !== null && ask !== null) {
									this.prices.set(assetId, {
										midpoint: (bid + ask) / 2,
										bestBid: bid,
										bestAsk: ask,
										timestamp: Date.now(),
									});
								}
							}
						}
					}
				}
			} catch (err) {
				logger.error(
					`Error parsing Polymarket WS message: ${err} , data: ${data}`,
				);
				this.reconnect();
			}
		});

		this.ws.on('close', () => {
			if (this.isStarted) {
				logger.warn(
					`⚠️ Polymarket WebSocket closed. Reconnecting in ${this.reconnectTimeoutMs}ms...`,
				);
				setTimeout(
					() => {
						if (!this.isStarted) return;
						this.reconnectTimeoutMs = Math.min(
							this.reconnectTimeoutMs * 2,
							this.maxReconnectTimeoutMs,
						);
						this.connect();
					},
					this.skipReconnectTimeout ? 0 : this.reconnectTimeoutMs,
				);
				this.skipReconnectTimeout = false;
			}
		});

		this.ws.on('error', (err: Error) => {
			logger.error(`❌ Polymarket WebSocket error: ${err.message}`);
		});
	}

	private resubscribe(): void {
		if (
			this.subscribedTokens.size > 0 &&
			this.ws?.readyState === WebSocket.OPEN
		) {
			const tokens = Array.from(this.subscribedTokens);
			logger.info(
				`🔄 Resubscribing to ${tokens.length} Polymarket tokens`,
			);
			this.ws.send(
				JSON.stringify({
					type: 'subscribe',
					topic: 'book',
					assets_ids: tokens,
				}),
			);
		}
	}

	public subscribe(tokenIds: string[]): void {
		const newTokens = tokenIds.filter(
			(id) => !this.subscribedTokens.has(id),
		);
		if (newTokens.length === 0) return;

		newTokens.forEach((id) => this.subscribedTokens.add(id));

		if (this.ws?.readyState === WebSocket.OPEN) {
			logger.info(
				`📡 Subscribing to Polymarket tokens: ${newTokens.join(', ')}`,
			);
			this.ws.send(
				JSON.stringify({
					type: 'subscribe',
					topic: 'book',
					assets_ids: newTokens,
				}),
			);
		}
	}

	public getPrice(tokenId: string): WsPrice | null {
		const data = this.prices.get(tokenId);
		if (!data) return null;

		// Check freshness
		if (Date.now() - data.timestamp > this.dataFreshnessMs) {
			return null;
		}
		return data;
	}

	public unsubscribe(tokenIds: string[]): void {
		const toUnsub = tokenIds.filter((id) => this.subscribedTokens.has(id));
		if (toUnsub.length === 0) return;

		toUnsub.forEach((id) => {
			this.subscribedTokens.delete(id);
			this.prices.delete(id);
		});

		if (this.ws?.readyState === WebSocket.OPEN) {
			logger.info(
				`📡 Unsubscribing from Polymarket tokens: ${toUnsub.join(', ')}`,
			);
			this.ws.send(
				JSON.stringify({
					type: 'unsubscribe',
					topic: 'book',
					assets_ids: toUnsub,
				}),
			);
		}
	}

	/**
	 * Keep only the specified tokens and unsubscribe from everything else
	 */
	public keepOnly(tokenIds: string[]): void {
		const keepSet = new Set(tokenIds);
		const toRemove: string[] = [];

		for (const id of this.subscribedTokens) {
			if (!keepSet.has(id)) {
				toRemove.push(id);
			}
		}

		if (toRemove.length > 0) {
			logger.info(`🧹 Cleanup: removing ${toRemove.length} stale tokens`);
			this.unsubscribe(toRemove);
		}
	}

	public reconnect(): void {
		logger.warn('🔄 Manual Polymarket WebSocket reconnect requested');
		if (this.ws) {
			this.skipReconnectTimeout = true;
			this.ws.close();
			// The 'close' event handler will automatically call this.connect()
		} else {
			this.connect();
		}
	}

	public stop(): void {
		this.isStarted = false;
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		logger.info('🔌 Polymarket WebSocket service stopped');
	}
}

const polymarketWsService = new PolymarketWsService();
export default polymarketWsService;
