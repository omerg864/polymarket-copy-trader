import {
	DEFAULT_STRATEGY_CONFIG,
	type BotStats,
	type Trade,
} from '@shared/types';
import Redis from 'ioredis';
import config from '../config';
import logger from '../utils/logger';

class RedisService {
	private client: Redis | null = null;
	private readonly prefix = 'pmbot:';

	async connect(): Promise<void> {
		this.client = new Redis(config.redisUrl, {
			retryStrategy: (times: number) => {
				if (times > 3) {
					logger.error('Redis connection failed after 3 retries');
					return null;
				}
				return Math.min(times * 500, 2000);
			},
			lazyConnect: true,
		});

		this.client.on('error', (err: Error) => {
			logger.error(`Redis error: ${err.message}`);
		});

		this.client.on('connect', () => {
			logger.info('✅ Connected to Redis');
		});

		await this.client.connect();
	}

	async disconnect(): Promise<void> {
		if (this.client) {
			await this.client.quit();
			logger.info('Redis disconnected');
		}
	}

	private _key(type: string, id: string): string {
		return `${this.prefix}${type}:${id}`;
	}

	private getClient(): Redis {
		if (!this.client) throw new Error('Redis client not connected');
		return this.client;
	}

	/**
	 * Read a raw key from Redis (used by strategyConfig service).
	 */
	async getRaw(key: string): Promise<string | null> {
		const client = this.getClient();
		return client.get(key);
	}

	// ---- Active Trades ----

	async saveTrade(trade: Trade): Promise<Trade> {
		const client = this.getClient();
		const key = this._key('trade', trade.id);
		await client.set(key, JSON.stringify(trade));
		await client.sadd(`${this.prefix}active_trades`, trade.id);
		return trade;
	}

	async getTrade(tradeId: string): Promise<Trade | null> {
		const client = this.getClient();
		const data = await client.get(this._key('trade', tradeId));
		return data ? (JSON.parse(data) as Trade) : null;
	}

	async getActiveTrades(): Promise<Trade[]> {
		const client = this.getClient();
		const ids = await client.smembers(`${this.prefix}active_trades`);
		if (ids.length === 0) return [];

		const trades = await Promise.all(ids.map((id) => this.getTrade(id)));
		return trades.filter((t): t is Trade => t !== null);
	}

	async removeTrade(tradeId: string): Promise<void> {
		const client = this.getClient();
		await client.del(this._key('trade', tradeId));
		await client.srem(`${this.prefix}active_trades`, tradeId);
	}

	// ---- Trade History ----

	async saveTradeHistory(trade: Trade): Promise<Trade> {
		const client = this.getClient();
		const key = `${this.prefix}history`;
		const record: Trade = {
			...trade,
			closedAt: new Date().toISOString(),
		};
		await client.lpush(key, JSON.stringify(record));
		// Keep last 500 trades
		await client.ltrim(key, 0, 499);
		return record;
	}

	async getTradeHistory(limit: number = 50): Promise<Trade[]> {
		const client = this.getClient();
		const key = `${this.prefix}history`;
		const records = await client.lrange(key, 0, limit - 1);
		return records.map((r) => JSON.parse(r) as Trade);
	}

	// ---- Market Cache ----

	async saveMarketCache(
		conditionId: string,
		marketData: unknown,
		ttlSeconds: number = 600,
	): Promise<void> {
		const client = this.getClient();
		const key = this._key('market', conditionId);
		await client.set(key, JSON.stringify(marketData), 'EX', ttlSeconds);
	}

	async getMarketCache(conditionId: string): Promise<unknown | null> {
		const client = this.getClient();
		const data = await client.get(this._key('market', conditionId));
		return data ? JSON.parse(data) : null;
	}

	// ---- Bot State ----

	async saveBotState(state: Record<string, unknown>): Promise<void> {
		const client = this.getClient();
		await client.set(`${this.prefix}state:bot`, JSON.stringify(state));
	}

	async getBotState(): Promise<Record<string, unknown> | null> {
		const client = this.getClient();
		const data = await client.get(`${this.prefix}state:bot`);
		return data ? (JSON.parse(data) as Record<string, unknown>) : null;
	}

	async isStopRequested(): Promise<boolean> {
		const client = this.getClient();
		const raw = await client.get(`${this.prefix}state:stop_requested`);
		return raw === 'true';
	}

	async setStopRequested(requested: boolean): Promise<void> {
		const client = this.getClient();
		await client.set(
			`${this.prefix}state:stop_requested`,
			requested ? 'true' : 'false',
		);
	}

	async setBotStartTime(ms: number): Promise<void> {
		const client = this.getClient();
		await client.set(`${this.prefix}state:start_time`, ms.toString());
	}

	async getBotStartTime(): Promise<number | null> {
		const client = this.getClient();
		const raw = await client.get(`${this.prefix}state:start_time`);
		return raw ? parseInt(raw, 10) : null;
	}

	// ---- Bot Balance (Live or Demo) ----

	async getBotBalance(): Promise<number> {
		const client = this.getClient();
		const prefix = config.isDemo ? 'demo' : 'live';
		const raw = await client.get(`${this.prefix}${prefix}:balance`);
		if (raw === null || raw === undefined)
			return DEFAULT_STRATEGY_CONFIG.botAllowance;
		const balance = parseFloat(raw);
		return isNaN(balance) ? DEFAULT_STRATEGY_CONFIG.botAllowance : balance;
	}

	async setBotBalance(balance: number): Promise<void> {
		const client = this.getClient();
		const prefix = config.isDemo ? 'demo' : 'live';
		const val = isNaN(balance)
			? DEFAULT_STRATEGY_CONFIG.botAllowance
			: balance;
		await client.set(`${this.prefix}${prefix}:balance`, val.toString());
	}

	async getBotStats(): Promise<BotStats> {
		const client = this.getClient();
		const prefix = config.isDemo ? 'demo' : 'live';
		const data = await client.get(`${this.prefix}${prefix}:stats`);
		return data
			? (JSON.parse(data) as BotStats)
			: { totalTrades: 0, wins: 0, losses: 0, totalPnl: 0 };
	}

	async updateBotStats(stats: BotStats): Promise<void> {
		const client = this.getClient();
		const prefix = config.isDemo ? 'demo' : 'live';
		await client.set(
			`${this.prefix}${prefix}:stats`,
			JSON.stringify(stats),
		);
	}

	async getSystemStats(): Promise<{ memoryUsed: string; totalKeys: number }> {
		try {
			const client = this.getClient();
			const info = await client.info();

			const memMatch = info.match(/used_memory_human:([^\r\n]+)/);
			const memoryUsed = memMatch ? memMatch[1] : 'Unknown';

			const keysMatch = info.match(/db0:keys=(\d+)/);
			const totalKeys = keysMatch ? parseInt(keysMatch[1], 10) : 0;

			return { memoryUsed, totalKeys };
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			logger.error(`Failed to get Redis stats: ${message}`);
			return { memoryUsed: 'Error', totalKeys: 0 };
		}
	}
}

const redisService = new RedisService();
export default redisService;
