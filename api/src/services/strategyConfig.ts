import {
	DEFAULT_STRATEGY_CONFIG,
	resolveStrategyConfig,
	type StrategyConfig,
} from '../../../shared/src/types';
import { StrategyConfigModel } from '../models/StrategyConfig';
import { redis } from './redis';

const CACHE_KEY = 'pmbot:strategy_config';

const STRATEGY_KEYS = Object.keys(
	DEFAULT_STRATEGY_CONFIG,
) as (keyof StrategyConfig)[];

/**
 * Get the full strategy config. Uses Redis cache first, falls back to MongoDB.
 */
export async function getStrategyConfig(): Promise<StrategyConfig> {
	// Try cache first
	const cached = await redis.get(CACHE_KEY);
	if (cached) {
		return JSON.parse(cached) as StrategyConfig;
	}

	// Read from MongoDB
	const docs = await StrategyConfigModel.find({});
	const partial: Partial<StrategyConfig> = {};

	for (const doc of docs) {
		if (STRATEGY_KEYS.includes(doc.key as keyof StrategyConfig)) {
			(partial as any)[doc.key] = doc.value;
		}
	}

	const result = resolveStrategyConfig(partial);

	// Write to cache
	await redis.set(CACHE_KEY, JSON.stringify(result));

	return result;
}

/**
 * Update strategy config values. Only updates the keys provided.
 * Invalidates the Redis cache after updating.
 */
export async function updateStrategyConfig(
	updates: Partial<StrategyConfig>,
): Promise<StrategyConfig> {
	const ops = Object.entries(updates)
		.filter(([key]) => STRATEGY_KEYS.includes(key as keyof StrategyConfig))
		.map(([key, value]) => ({
			updateOne: {
				filter: { key },
				update: { $set: { value } },
				upsert: true,
			},
		}));

	if (ops.length > 0) {
		await StrategyConfigModel.bulkWrite(ops);
	}

	// Invalidate cache
	await redis.del(CACHE_KEY);

	return getStrategyConfig();
}
