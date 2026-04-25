import {
	DEFAULT_STRATEGY_CONFIG,
	REDIS_KEYS,
	resolveStrategyConfig,
	type StrategyConfig,
	type TradeType,
} from '../../../shared/src/index';
import { StrategyConfigModel } from '../models/StrategyConfig';
import { redis } from './redis';

const STRATEGY_KEYS = Object.keys(
	DEFAULT_STRATEGY_CONFIG,
) as (keyof StrategyConfig)[];

/**
 * Get the full strategy config. Uses Redis cache first, falls back to MongoDB.
 */
export async function getStrategyConfig(mode: TradeType): Promise<StrategyConfig> {
	const cacheKey = REDIS_KEYS.STRATEGY_CONFIG(mode);
	
	// Try cache first
	const cached = await redis.get(cacheKey);
	if (cached) {
		return JSON.parse(cached) as StrategyConfig;
	}

	// Read from MongoDB
	const docs = await StrategyConfigModel.find({ mode });
	const partial: Partial<StrategyConfig> = {};

	for (const doc of docs) {
		if (STRATEGY_KEYS.includes(doc.key as keyof StrategyConfig)) {
			(partial as any)[doc.key] = doc.value;
		}
	}

	const result = resolveStrategyConfig(partial);

	// Write to cache
	await redis.set(cacheKey, JSON.stringify(result));

	return result;
}

/**
 * Update strategy config values. Only updates the keys provided.
 * Invalidates the Redis cache after updating.
 */
export async function updateStrategyConfig(
	mode: TradeType,
	updates: Partial<StrategyConfig>,
): Promise<StrategyConfig> {
	const ops = Object.entries(updates)
		.filter(([key]) => STRATEGY_KEYS.includes(key as keyof StrategyConfig))
		.map(([key, value]) => ({
			updateOne: {
				filter: { key, mode },
				update: { $set: { value } },
				upsert: true,
			},
		}));

	if (ops.length > 0) {
		await StrategyConfigModel.bulkWrite(ops);
	}

	// Invalidate cache
	await redis.del(REDIS_KEYS.STRATEGY_CONFIG(mode));

	return getStrategyConfig(mode);
}
