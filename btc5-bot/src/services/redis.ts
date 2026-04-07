import {
	DEFAULT_STRATEGY_CONFIG,
	REDIS_KEYS,
	REDIS_PREFIX,
	StrategyConfig,
	type BotStats,
	type Trade,
} from '@shared/index';
import Redis from 'ioredis';
import config from '../config';
import logger from '../utils/logger';

class RedisService {
	private client: Redis;
	private readonly mode = config.isDemo ? 'demo' : 'live';

	constructor() {
		this.client = new Redis(config.redisUrl, {
			retryStrategy: (times: number) => {
				if (times > 3) {
					logger.error('Redis connection failed after 3 retries');
					return null;
				}
				return Math.min(times * 500, 2000);
			},
			lazyConnect: true,
			maxRetriesPerRequest: null,
		});

		this.client.on('error', (err: Error) => {
			logger.error(`Redis error: ${err.message}`);
		});

		this.client.on('connect', () => {
			logger.info('✅ Connected to Redis');
		});
	}

	async connect(): Promise<void> {
		if (
			this.client.status === 'ready' ||
			this.client.status === 'connecting'
		) {
			return;
		}
		await this.client.connect();
	}

	async disconnect(): Promise<void> {
		await this.client.quit();
		logger.info('Redis disconnected');
	}

	private getClient(): Redis {
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
		const key = `${REDIS_KEYS.TRADE_PREFIX(this.mode)}${trade.id}`;
		await client.set(key, JSON.stringify(trade));
		await client.sadd(REDIS_KEYS.ACTIVE_TRADES(this.mode), trade.id);
		return trade;
	}

	async getTrade(tradeId: string): Promise<Trade | null> {
		const client = this.getClient();
		const data = await client.get(
			`${REDIS_KEYS.TRADE_PREFIX(this.mode)}${tradeId}`,
		);
		return data ? (JSON.parse(data) as Trade) : null;
	}

	async getActiveTrades(): Promise<Trade[]> {
		const client = this.getClient();
		const ids = await client.smembers(REDIS_KEYS.ACTIVE_TRADES(this.mode));
		if (ids.length === 0) return [];

		const trades = await Promise.all(ids.map((id) => this.getTrade(id)));
		return trades.filter((t): t is Trade => t !== null);
	}

	async removeTrade(tradeId: string): Promise<void> {
		const client = this.getClient();
		await client.del(`${REDIS_KEYS.TRADE_PREFIX(this.mode)}${tradeId}`);
		await client.srem(REDIS_KEYS.ACTIVE_TRADES(this.mode), tradeId);
	}

	// ---- Trade History ----

	async saveTradeHistory(trade: Trade): Promise<Trade> {
		const client = this.getClient();
		const historyKey = REDIS_KEYS.HISTORY(this.mode);
		const idsKey = REDIS_KEYS.HISTORY_IDS(this.mode);

		const record: Trade = {
			...trade,
			closedAt: new Date().toISOString(),
		};
		await client.lpush(historyKey, JSON.stringify(record));
		await client.sadd(idsKey, trade.id);
		// Keep last 500,000 trades
		await client.ltrim(historyKey, 0, 499999);
		return record;
	}

	async getTradeHistory(limit: number = 50): Promise<Trade[]> {
		const client = this.getClient();
		const key = REDIS_KEYS.HISTORY(this.mode);
		const records = await client.lrange(key, 0, limit - 1);
		return records.map((r) => JSON.parse(r) as Trade);
	}

	async updateTradeInHistory(trade: Trade): Promise<void> {
		const client = this.getClient();
		const key = REDIS_KEYS.HISTORY(this.mode);
		const records = await client.lrange(key, 0, -1);
		const trades = records.map((r) => JSON.parse(r) as Trade);

		const index = trades.findIndex((t) => t.id === trade.id);
		if (index !== -1) {
			await client.lset(key, index, JSON.stringify(trade));
		}
	}

	async isTradeInHistory(tradeId: string): Promise<boolean> {
		const client = this.getClient();
		const result = await client.sismember(
			REDIS_KEYS.HISTORY_IDS(this.mode),
			tradeId,
		);
		return result === 1;
	}

	// ---- Market Cache ----

	async saveMarketCache(
		conditionId: string,
		marketData: unknown,
		ttlSeconds: number = 600,
	): Promise<void> {
		const client = this.getClient();
		const key = `${REDIS_PREFIX}market:${conditionId}`;
		await client.set(key, JSON.stringify(marketData), 'EX', ttlSeconds);
	}

	async getMarketCache(conditionId: string): Promise<unknown | null> {
		const client = this.getClient();
		const key = `${REDIS_PREFIX}market:${conditionId}`;
		const data = await client.get(key);
		return data ? JSON.parse(data) : null;
	}

	// ---- Bot State ----

	async saveBotState(state: Record<string, unknown>): Promise<void> {
		const client = this.getClient();
		await client.set(`${REDIS_PREFIX}state:bot`, JSON.stringify(state));
	}

	async getBotState(): Promise<Record<string, unknown> | null> {
		const client = this.getClient();
		const data = await client.get(`${REDIS_PREFIX}state:bot`);
		return data ? (JSON.parse(data) as Record<string, unknown>) : null;
	}

	async isStopRequested(): Promise<boolean> {
		const client = this.getClient();
		const raw = await client.get(REDIS_KEYS.STOP_REQUESTED(this.mode));
		return raw === 'true';
	}

	async setStopRequested(requested: boolean): Promise<void> {
		const client = this.getClient();
		await client.set(
			REDIS_KEYS.STOP_REQUESTED(this.mode),
			requested ? 'true' : 'false',
		);
	}

	async getDailyStop(): Promise<{ stopped: boolean; date: string } | null> {
		const client = this.getClient();
		const raw = await client.get(REDIS_KEYS.DAILY_STOP(this.mode));
		if (!raw) return null;
		try {
			return JSON.parse(raw);
		} catch (err) {
			return null;
		}
	}

	async setDailyStop(stopped: boolean, date: string): Promise<void> {
		const client = this.getClient();
		await client.set(
			REDIS_KEYS.DAILY_STOP(this.mode),
			JSON.stringify({ stopped, date }),
		);
	}

	async setBotStartTime(ms: number): Promise<void> {
		const client = this.getClient();
		await client.set(REDIS_KEYS.START_TIME(this.mode), ms.toString());
	}

	async getBotStartTime(): Promise<number | null> {
		const client = this.getClient();
		const raw = await client.get(REDIS_KEYS.START_TIME(this.mode));
		return raw ? parseInt(raw, 10) : null;
	}

	async setBotVersion(version: string): Promise<void> {
		const client = this.getClient();
		await client.set(REDIS_KEYS.BOT_VERSION, version);
	}

	// ---- Daily PnL ----

	async getDailyPnl(date: string): Promise<number> {
		const client = this.getClient();
		const key = REDIS_KEYS.DAILY_PNL(this.mode, date);
		const raw = await client.hget(key, 'pnl');
		if (raw === null) return 0;
		return parseFloat(raw) || 0;
	}

	async getDailyStats(
		date: string,
	): Promise<{ pnl: number; wins: number; losses: number }> {
		const client = this.getClient();
		const key = REDIS_KEYS.DAILY_PNL(this.mode, date);
		const data = await client.hgetall(key);
		return {
			pnl: parseFloat(data.pnl) || 0,
			wins: parseInt(data.wins, 10) || 0,
			losses: parseInt(data.losses, 10) || 0,
		};
	}

	async incrementDailyPnl(
		date: string,
		pnl: number,
		won: boolean,
	): Promise<void> {
		const client = this.getClient();
		const key = REDIS_KEYS.DAILY_PNL(this.mode, date);

		// If it's a string (old format), remove it
		const type = await client.type(key);
		if (type === 'string') {
			await client.del(key);
		}

		await client.hincrbyfloat(key, 'pnl', pnl);
		await client.hincrby(key, won ? 'wins' : 'losses', 1);
		// Expire after 3 days to keep Redis clean
		await client.expire(key, 60 * 60 * 24 * 3);
	}

	// ---- Bot Balance (Live or Demo) ----

	async getBotBalance(config?: StrategyConfig): Promise<number> {
		const client = this.getClient();
		const mode = config?.mode || this.mode;
		const key = REDIS_KEYS.BALANCE(mode);
		const raw = await client.get(key);
		if (raw !== null && raw !== undefined) {
			const balance = parseFloat(raw);
			if (!isNaN(balance)) return balance;
		}
		const botAllowance =
			config?.botAllowance ?? DEFAULT_STRATEGY_CONFIG.botAllowance;
		return botAllowance;
	}

	async setBotBalance(balance: number): Promise<void> {
		const client = this.getClient();
		const key = REDIS_KEYS.BALANCE(this.mode);
		const val = isNaN(balance)
			? DEFAULT_STRATEGY_CONFIG.botAllowance
			: balance;
		await client.set(key, val.toString());
	}

	async getBotStats(): Promise<BotStats> {
		const client = this.getClient();
		const key = REDIS_KEYS.STATS(this.mode);
		const data = await client.get(key);
		return data
			? (JSON.parse(data) as BotStats)
			: { totalTrades: 0, wins: 0, losses: 0, totalPnl: 0, totalFees: 0 };
	}

	async updateBotStats(stats: BotStats): Promise<void> {
		const client = this.getClient();
		const key = REDIS_KEYS.STATS(this.mode);
		await client.set(key, JSON.stringify(stats));
	}

	async setBtcPrice(btcPrice: number): Promise<void> {
		const client = this.getClient();
		await client.set(
			REDIS_KEYS.BTC_PRICE,
			JSON.stringify({ btcPrice, updatedAt: Date.now() }),
		);
	}

	async setPriceToBeat(
		priceToBeat: number | null,
		marketTitle: string,
		marketStartTime?: number,
		marketEndTime?: number,
	): Promise<void> {
		const client = this.getClient();
		await client.set(
			REDIS_KEYS.REF_PRICE,
			JSON.stringify({
				priceToBeat,
				marketTitle,
				marketStartTime,
				marketEndTime,
			}),
		);
	}

	async setMarketPrices(
		upPrice: number | null,
		downPrice: number | null,
	): Promise<void> {
		const client = this.getClient();
		await client.set(
			REDIS_KEYS.MARKET_PRICES,
			JSON.stringify({ upPrice, downPrice, updatedAt: Date.now() }),
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

	async setLastSignal(signal: any): Promise<void> {
		const client = this.getClient();
		await client.set(REDIS_KEYS.SIGNAL, JSON.stringify(signal), 'EX', 60); // Expire after 60s
	}

	async getLastSignal(): Promise<any | null> {
		const client = this.getClient();
		const data = await client.get(REDIS_KEYS.SIGNAL);
		return data ? JSON.parse(data) : null;
	}

	/**
	 * Check if a throttle key exists. If not, set it with the given TTL.
	 * Returns true if the key was set (not throttled), false if it already exists (throttled).
	 */
	async checkThrottle(key: string, ttlSeconds: number): Promise<boolean> {
		const client = this.getClient();
		const result = await client.set(key, '1', 'EX', ttlSeconds, 'NX');
		return result === 'OK';
	}
}

const redisService = new RedisService();
export default redisService;
