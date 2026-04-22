import {
	REDIS_KEYS,
	getTradeKey,
	type MarketDashboardData,
	type RedisInfo,
	type StrategyConfig,
	type Trade,
} from '../../../shared/src/index';
import { DEFAULT_STRATEGY_CONFIG } from '../../../shared/src/types';
import Redis from 'ioredis';
import config from '../config';

const redis = new Redis(config.redisUrl);

redis.on('error', (err: Error) => {
	console.error('Redis connection error:', err.message);
});

redis.on('connect', () => {
	console.log('Connected to Redis');
});

export async function getActiveTrades(): Promise<Trade[]> {
	const isDemo = config.isDemo;
	const mode = isDemo ? 'demo' : 'live';
	
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

export async function getBotStats(): Promise<BotStats> {
	const key = REDIS_KEYS.STATS(config.isDemo ? 'demo' : 'live');
	const raw = await redis.get(key);
	return raw
		? (JSON.parse(raw) as BotStats)
		: { totalTrades: 0, wins: 0, losses: 0, totalPnl: 0, totalFees: 0 };
}

export async function setBotStats(stats: BotStats): Promise<void> {
	const key = REDIS_KEYS.STATS(config.isDemo ? 'demo' : 'live');
	await redis.set(key, JSON.stringify(stats));
}

export async function getBotBalance(
	configParams?: StrategyConfig,
): Promise<number> {
	const mode = configParams?.mode || (config.isDemo ? 'demo' : 'live');
	const key = REDIS_KEYS.BALANCE(mode);
	const raw = await redis.get(key);
	if (raw) {
		const balance = parseFloat(raw);
		if (!isNaN(balance)) return balance;
	}
	const botAllowance =
		configParams?.botAllowance ?? DEFAULT_STRATEGY_CONFIG.botAllowance;
	return botAllowance;
}

export async function setBotBalance(balance: number): Promise<void> {
	const isDemo = config.isDemo;
	const key = REDIS_KEYS.BALANCE(isDemo ? 'demo' : 'live');
	await redis.set(key, balance.toString());
}

export async function getBotStartTime(
	mode?: 'demo' | 'live',
): Promise<number | null> {
	const activeMode = mode || (config.isDemo ? 'demo' : 'live');
	const raw = await redis.get(REDIS_KEYS.START_TIME(activeMode));
	return raw ? parseInt(raw, 10) : null;
}

export async function setBotStartTime(
	startTime: number,
	mode?: 'demo' | 'live',
): Promise<void> {
	const activeMode = mode || (config.isDemo ? 'demo' : 'live');
	await redis.set(REDIS_KEYS.START_TIME(activeMode), startTime.toString());
}

export async function getStopRequested(): Promise<boolean> {
	const isDemo = config.isDemo;
	const val = await redis.get(
		REDIS_KEYS.STOP_REQUESTED(isDemo ? 'demo' : 'live'),
	);
	return val === 'true';
}

export async function setStopRequested(stop: boolean): Promise<void> {
	const isDemo = config.isDemo;
	await redis.set(
		REDIS_KEYS.STOP_REQUESTED(isDemo ? 'demo' : 'live'),
		stop ? 'true' : 'false',
	);
}

export async function flushRedis(): Promise<void> {
	await redis.flushdb();
}

/**
 * Clears bot state only for the specified mode (demo or live).
 * Preserves global data like price feeds and config cache.
 */
export async function clearModeData(mode: 'demo' | 'live'): Promise<void> {
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
	await setBotStartTime(Date.now(), mode);

	console.log(`Cleared all ${mode} state from Redis`);
}

export async function getMarketPrices(): Promise<MarketDashboardData | null> {
	const [btcRaw, refRaw, marketPriceRaw, signalRaw] = await Promise.all([
		redis.get(REDIS_KEYS.BTC_PRICE),
		redis.get(REDIS_KEYS.REF_PRICE),
		redis.get(REDIS_KEYS.MARKET_PRICES),
		redis.get(REDIS_KEYS.SIGNAL),
	]);
	if (!btcRaw) return null;
	const btcData = JSON.parse(btcRaw) as {
		btcPrice: number;
		updatedAtCode?: number;
		updatedAt: number;
	};
	const refData = refRaw
		? (JSON.parse(refRaw) as {
				priceToBeat: number | null;
				marketTitle: string;
				marketStartTime?: number;
				marketEndTime?: number;
			})
		: null;
	const marketPriceData = marketPriceRaw
		? (JSON.parse(marketPriceRaw) as {
				upPrice: number | null;
				downPrice: number | null;
				updatedAt?: number;
			})
		: null;
	const signalData = signalRaw ? JSON.parse(signalRaw) : null;

	return {
		btcPrice: btcData.btcPrice,
		updatedAt: btcData.updatedAt,
		priceToBeat: refData?.priceToBeat ?? null,
		marketTitle: refData?.marketTitle ?? null,
		upPrice: marketPriceData?.upPrice ?? null,
		downPrice: marketPriceData?.downPrice ?? null,
		marketStartTime: refData?.marketStartTime ?? null,
		marketEndTime: refData?.marketEndTime ?? null,
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

export async function getDailyPnl(date: string): Promise<number> {
	const isDemo = config.isDemo;
	const key = REDIS_KEYS.DAILY_PNL(isDemo ? 'demo' : 'live', date);
	const raw = await redis.hget(key, 'pnl');
	if (raw === null) return 0;
	return parseFloat(raw) || 0;
}

export async function getDailyStats(
	date: string,
): Promise<{ pnl: number; wins: number; losses: number }> {
	const isDemo = config.isDemo;
	const key = REDIS_KEYS.DAILY_PNL(isDemo ? 'demo' : 'live', date);
	const data = await redis.hgetall(key);
	return {
		pnl: parseFloat(data.pnl) || 0,
		wins: parseInt(data.wins, 10) || 0,
		losses: parseInt(data.losses, 10) || 0,
	};
}

export async function setDailyStats(
	date: string,
	stats: { pnl: number; wins: number; losses: number },
): Promise<void> {
	const isDemo = config.isDemo;
	const key = REDIS_KEYS.DAILY_PNL(isDemo ? 'demo' : 'live', date);

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

export async function getBotVersion(): Promise<string | null> {
	return redis.get(REDIS_KEYS.BOT_VERSION);
}

export { redis, REDIS_KEYS, getTradeKey };
