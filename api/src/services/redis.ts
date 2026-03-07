import type { Trade } from '@polymarket-bot/shared';
import Redis from 'ioredis';
import config from '../config';

const PREFIX = 'pmbot:';

const redis = new Redis(config.redisUrl);

redis.on('error', (err: Error) => {
	console.error('Redis connection error:', err.message);
});

redis.on('connect', () => {
	console.log('Connected to Redis');
});

export async function getActiveTrades(): Promise<Trade[]> {
	const ids = await redis.smembers(`${PREFIX}active_trades`);
	if (ids.length === 0) return [];

	const trades = await Promise.all(
		ids.map(async (id) => {
			const data = await redis.get(`${PREFIX}trade:${id}`);
			return data ? (JSON.parse(data) as Trade) : null;
		}),
	);

	return trades.filter((t): t is Trade => t !== null);
}

export async function getTradeHistory(limit: number = 100): Promise<Trade[]> {
	const records = await redis.lrange(`${PREFIX}history`, 0, limit - 1);
	return records.map((r) => JSON.parse(r) as Trade);
}

interface BotStats {
	totalTrades: number;
	wins: number;
	losses: number;
	totalPnl: number;
}

export async function getBotStats(): Promise<BotStats> {
	const key = `${PREFIX}${config.isDemo ? 'demo' : 'live'}:stats`;
	const raw = await redis.get(key);
	return raw
		? (JSON.parse(raw) as BotStats)
		: { totalTrades: 0, wins: 0, losses: 0, totalPnl: 0 };
}

export async function getBotBalance(): Promise<number> {
	const key = `${PREFIX}${config.isDemo ? 'demo' : 'live'}:balance`;
	const raw = await redis.get(key);
	return raw ? parseFloat(raw) : config.botAllowance;
}

export async function getBotStartTime(): Promise<number | null> {
	const raw = await redis.get(`${PREFIX}state:start_time`);
	return raw ? parseInt(raw, 10) : null;
}

export async function getStopRequested(): Promise<boolean> {
	const val = await redis.get(`${PREFIX}state:stop_requested`);
	return val === 'true';
}

export async function setStopRequested(stop: boolean): Promise<void> {
	await redis.set(`${PREFIX}state:stop_requested`, stop ? 'true' : 'false');
}

export async function flushRedis(): Promise<void> {
	await redis.flushdb();
}

export async function getRedisInfo(): Promise<{
	memoryUsed: string;
	totalKeys: number;
}> {
	const info = await redis.info();

	const memMatch = info.match(/used_memory_human:([^\r\n]+)/);
	const memoryUsed = memMatch ? memMatch[1] : 'Unknown';

	const keysMatch = info.match(/db0:keys=(\d+)/);
	const totalKeys = keysMatch ? parseInt(keysMatch[1], 10) : 0;

	return { memoryUsed, totalKeys };
}

export { redis };
