import Redis from 'ioredis';
import config from '../config.js';
import logger from '../utils/logger.js';

class RedisService {
	constructor() {
		this.client = null;
		this.prefix = 'pmbot:';
	}

	async connect() {
		this.client = new Redis(config.redisUrl, {
			retryStrategy: (times) => {
				if (times > 3) {
					logger.error('Redis connection failed after 3 retries');
					return null;
				}
				return Math.min(times * 500, 2000);
			},
			lazyConnect: true,
		});

		this.client.on('error', (err) => {
			logger.error(`Redis error: ${err.message}`);
		});

		this.client.on('connect', () => {
			logger.info('✅ Connected to Redis');
		});

		await this.client.connect();
	}

	async disconnect() {
		if (this.client) {
			await this.client.quit();
			logger.info('Redis disconnected');
		}
	}

	_key(type, id) {
		return `${this.prefix}${type}:${id}`;
	}

	// ---- Active Trades ----

	async saveTrade(trade) {
		const key = this._key('trade', trade.id);
		await this.client.set(key, JSON.stringify(trade));
		await this.client.sadd(`${this.prefix}active_trades`, trade.id);
		return trade;
	}

	async getTrade(tradeId) {
		const data = await this.client.get(this._key('trade', tradeId));
		return data ? JSON.parse(data) : null;
	}

	async getActiveTrades() {
		const ids = await this.client.smembers(`${this.prefix}active_trades`);
		if (ids.length === 0) return [];

		const trades = await Promise.all(ids.map((id) => this.getTrade(id)));
		return trades.filter(Boolean);
	}

	async removeTrade(tradeId) {
		await this.client.del(this._key('trade', tradeId));
		await this.client.srem(`${this.prefix}active_trades`, tradeId);
	}

	// ---- Trade History ----

	async saveTradeHistory(trade) {
		const key = `${this.prefix}history`;
		const record = {
			...trade,
			closedAt: new Date().toISOString(),
		};
		await this.client.lpush(key, JSON.stringify(record));
		// Keep last 500 trades
		await this.client.ltrim(key, 0, 499);
		return record;
	}

	async getTradeHistory(limit = 50) {
		const key = `${this.prefix}history`;
		const records = await this.client.lrange(key, 0, limit - 1);
		return records.map((r) => JSON.parse(r));
	}

	// ---- Market Cache ----

	async saveMarketCache(conditionId, marketData, ttlSeconds = 600) {
		const key = this._key('market', conditionId);
		await this.client.set(
			key,
			JSON.stringify(marketData),
			'EX',
			ttlSeconds,
		);
	}

	async getMarketCache(conditionId) {
		const data = await this.client.get(this._key('market', conditionId));
		return data ? JSON.parse(data) : null;
	}

	// ---- Bot State ----

	async saveBotState(state) {
		await this.client.set(`${this.prefix}state:bot`, JSON.stringify(state));
	}

	async getBotState() {
		const data = await this.client.get(`${this.prefix}state:bot`);
		return data ? JSON.parse(data) : null;
	}

	async isStopRequested() {
		const raw = await this.client.get(`${this.prefix}state:stop_requested`);
		return raw === 'true';
	}

	async setStopRequested(requested) {
		await this.client.set(
			`${this.prefix}state:stop_requested`,
			requested ? 'true' : 'false',
		);
	}

	async setBotStartTime(ms) {
		await this.client.set(`${this.prefix}state:start_time`, ms.toString());
	}

	async getBotStartTime() {
		const raw = await this.client.get(`${this.prefix}state:start_time`);
		return raw ? parseInt(raw, 10) : null;
	}

	// ---- Bot Balance (Live or Demo) ----

	async getBotBalance() {
		const prefix = config.isDemo ? 'demo' : 'live';
		const raw = await this.client.get(`${this.prefix}${prefix}:balance`);
		if (raw === null || raw === undefined) return config.botAllowance;
		const balance = parseFloat(raw);
		return isNaN(balance) ? config.botAllowance : balance;
	}

	async setBotBalance(balance) {
		const prefix = config.isDemo ? 'demo' : 'live';
		const val = isNaN(balance) ? config.botAllowance : balance;
		await this.client.set(
			`${this.prefix}${prefix}:balance`,
			val.toString(),
		);
	}

	async getBotStats() {
		const prefix = config.isDemo ? 'demo' : 'live';
		const data = await this.client.get(`${this.prefix}${prefix}:stats`);
		return data
			? JSON.parse(data)
			: { totalTrades: 0, wins: 0, losses: 0, totalPnl: 0 };
	}

	async updateBotStats(stats) {
		const prefix = config.isDemo ? 'demo' : 'live';
		await this.client.set(
			`${this.prefix}${prefix}:stats`,
			JSON.stringify(stats),
		);
	}
}

const redisService = new RedisService();
export default redisService;
