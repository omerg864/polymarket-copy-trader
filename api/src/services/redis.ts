import {
	TradeType,
	DEFAULT_STRATEGY_CONFIG,
	type MarketDashboardData,
	type RedisInfo,
	type StrategyConfig,
	type Trade,
} from '../../../shared/src/types';
import { REDIS_KEYS, getTradeKey } from '../../../shared/src/redisKeys';
import Redis from 'ioredis';
import config from '../config';

const redis = new Redis(config.redisUrl);

redis.on('error', (err: Error) => {
	console.error('Redis connection error:', err.message);
});

redis.on('connect', () => {
	console.log('Connected to Redis');
});

export async function getActiveTrades(mode: TradeType): Promise<Trade[]> {
	const [activeIds, resolvingIds] = await Promise.all([
		redis.smembers(REDIS_KEYS.ACTIVE_TRADES(mode)),
		redis.smembers(REDIS_KEYS.AWAITING_RESOLVE_TRADES(mode)),
	]);

	const ids = [...activeIds, ...resolvingIds];
	if (ids.length === 0) return [];

	const trades = await Promise.all(
		ids.map(async (id) => {
			const data = await redis.get(
				`${REDIS_KEYS.TRADE_PREFIX(mode)}${id}`,
			);
			return data ? (JSON.parse(data) as Trade) : null;
		}),
	);

	return trades.filter((t): t is Trade => t !== null);
}

interface BotStats {
	totalTrades: number;
	wins: number;
	losses: number;
	totalPnl: number;
	totalFees: number;
}

export async function getBotStats(mode: TradeType): Promise<BotStats> {
	const raw = await redis.get(REDIS_KEYS.STATS(mode));
	return raw
		? (JSON.parse(raw) as BotStats)
		: { totalTrades: 0, wins: 0, losses: 0, totalPnl: 0, totalFees: 0 };
}

export async function setBotStats(
	mode: TradeType,
	stats: BotStats,
): Promise<void> {
	await redis.set(REDIS_KEYS.STATS(mode), JSON.stringify(stats));
}

export async function getBotBalance(
	mode: TradeType,
	configParams?: StrategyConfig,
): Promise<number> {
	const raw = await redis.get(REDIS_KEYS.BALANCE(mode));
	if (raw) {
		const balance = parseFloat(raw);
		if (!isNaN(balance)) return balance;
	}
	const botAllowance =
		configParams?.botAllowance ?? DEFAULT_STRATEGY_CONFIG.botAllowance;
	return botAllowance;
}

export async function setBotBalance(
	mode: TradeType,
	balance: number,
): Promise<void> {
	const key = REDIS_KEYS.BALANCE(mode);
	await redis.set(key, balance.toString());
}

export async function getBotStartTime(mode: TradeType): Promise<number | null> {
	const raw = await redis.get(REDIS_KEYS.START_TIME(mode));
	return raw ? parseInt(raw, 10) : null;
}

export async function setBotStartTime(
	mode: TradeType,
	startTime: number,
): Promise<void> {
	await redis.set(REDIS_KEYS.START_TIME(mode), startTime.toString());
}

export async function getStopRequested(mode: TradeType): Promise<boolean> {
	const val = await redis.get(REDIS_KEYS.STOP_REQUESTED(mode));
	return val === 'true';
}

export async function setStopRequested(
	mode: TradeType,
	stop: boolean,
): Promise<void> {
	await redis.set(REDIS_KEYS.STOP_REQUESTED(mode), stop ? 'true' : 'false');
}

export async function flushRedis(): Promise<void> {
	await redis.flushdb();
}

/**
 * Clears bot state only for the specified mode (demo or live).
 * Preserves global data like price feeds and config cache.
 */
export async function clearModeData(mode: TradeType): Promise<void> {
	const keysToDelete = [
		REDIS_KEYS.ACTIVE_TRADES(mode),
		REDIS_KEYS.AWAITING_RESOLVE_TRADES(mode),
		REDIS_KEYS.BALANCE(mode),
		REDIS_KEYS.STATS(mode),
		REDIS_KEYS.HISTORY_IDS(mode),
		REDIS_KEYS.DAILY_STOP(mode),
		REDIS_KEYS.STOP_REQUESTED(mode),
	];

	// Find pattern-based keys
	const tradePrefix = REDIS_KEYS.TRADE_PREFIX(mode);
	const dailyPnlPrefix = REDIS_KEYS.DAILY_PNL(mode, '').replace(/:$/, ''); // Get prefix without trailing colon

	const [tradeKeys, dailyPnlKeys] = await Promise.all([
		redis.keys(`${tradePrefix}*`),
		redis.keys(`${dailyPnlPrefix}*`),
	]);

	keysToDelete.push(...tradeKeys, ...dailyPnlKeys);

	if (keysToDelete.length > 0) {
		await redis.del(...keysToDelete);
	}

	// Reset start time to now (using milliseconds for consistency)
	await setBotStartTime(mode, Date.now());

	console.log(`Cleared all ${mode} state from Redis`);
}

export async function getMarketPrices(
	mode: TradeType,
): Promise<MarketDashboardData | null> {
	const [marketPriceRaw, signalRaw] = await Promise.all([
		redis.get(REDIS_KEYS.MARKET_PRICES(mode)),
		redis.get(REDIS_KEYS.SIGNAL(mode)),
	]);

	const marketPriceData = marketPriceRaw
		? (JSON.parse(marketPriceRaw) as {
				upPrice: number | null;
				downPrice: number | null;
				updatedAt?: number;
			})
		: null;
	const signalData = signalRaw ? JSON.parse(signalRaw) : null;

	return {
		updatedAt: marketPriceData?.updatedAt ?? Date.now(),
		marketTitle: null,
		upPrice: marketPriceData?.upPrice ?? null,
		downPrice: marketPriceData?.downPrice ?? null,
		indicators: signalData?.indicators,
		confidence: signalData?.confidence,
		direction: signalData?.direction,
		indicatorsUpdatedAt: signalData?.updatedAt,
	};
}

export async function getRedisInfo(): Promise<RedisInfo> {
	const info = await redis.info();

	const memHumanMatch = info.match(/used_memory_human:([^\r\n]+)/);
	const memoryUsed = memHumanMatch ? memHumanMatch[1] : 'Unknown';

	const memBytesMatch = info.match(/used_memory:(\d+)/);
	const memoryUsedBytes = memBytesMatch ? parseInt(memBytesMatch[1], 10) : 0;

	const keysMatch = info.match(/db0:keys=(\d+)/);
	const totalKeys = keysMatch ? parseInt(keysMatch[1], 10) : 0;

	return { memoryUsed, memoryUsedBytes, totalKeys };
}

export async function getDailyPnl(
	mode: TradeType,
	date: string,
): Promise<number> {
	const key = REDIS_KEYS.DAILY_PNL(mode, date);
	const raw = await redis.hget(key, 'pnl');
	if (raw === null) return 0;
	return parseFloat(raw) || 0;
}

export async function getDailyStats(
	mode: TradeType,
	date: string,
): Promise<{ pnl: number; wins: number; losses: number }> {
	const key = REDIS_KEYS.DAILY_PNL(mode, date);
	const data = await redis.hgetall(key);
	return {
		pnl: parseFloat(data.pnl) || 0,
		wins: parseInt(data.wins, 10) || 0,
		losses: parseInt(data.losses, 10) || 0,
	};
}

export async function setDailyStats(
	mode: TradeType,
	date: string,
	stats: { pnl: number; wins: number; losses: number },
): Promise<void> {
	const key = REDIS_KEYS.DAILY_PNL(mode, date);

	// Clear if it was a string (legacy)
	const t = await redis.type(key);
	if (t === 'string') await redis.del(key);

	await redis.hset(key, {
		pnl: stats.pnl.toString(),
		wins: stats.wins.toString(),
		losses: stats.losses.toString(),
	});
	// Expire after 3 days to keep Redis clean (MongoDB is source of truth)
	await redis.expire(key, 60 * 60 * 24 * 3);
}

export async function getBotVersion(mode: TradeType): Promise<string | null> {
	return redis.get(REDIS_KEYS.BOT_VERSION(mode));
}

export { redis, REDIS_KEYS, getTradeKey };
