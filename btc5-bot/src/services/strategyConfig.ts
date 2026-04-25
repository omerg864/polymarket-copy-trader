import {
	DEFAULT_STRATEGY_CONFIG,
	REDIS_KEYS,
	resolveStrategyConfig,
	type StrategyConfig,
} from '@shared/index';
import { StrategyConfigModel } from '../models/StrategyConfig';
import logger from '../utils/logger';
import redisService from './redis';
import config from '../config';

const LOCAL_TTL_MS = 10_000; // 10 seconds local cache

const STRATEGY_KEYS = Object.keys(
	DEFAULT_STRATEGY_CONFIG,
) as (keyof StrategyConfig)[];

let localCache: StrategyConfig | null = null;
let localCacheTime = 0;

/**
 * Get strategy config from Redis, falling back to MongoDB, then defaults.
 * Uses a 10-second local in-memory cache to avoid hammering Redis every call.
 */
export async function getStrategyConfig(): Promise<StrategyConfig> {
	// Local in-memory cache first
	if (localCache && Date.now() - localCacheTime < LOCAL_TTL_MS) {
		return localCache;
	}

	const cacheKey = REDIS_KEYS.STRATEGY_CONFIG(config.mode);

	// Try Redis
	try {
		const raw = await redisService.getRaw(cacheKey);
		if (raw) {
			const parsed = resolveStrategyConfig(
				JSON.parse(raw) as Partial<StrategyConfig>,
			);
			localCache = parsed;
			localCacheTime = Date.now();
			return parsed;
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		logger.error(`Failed to read strategy config from Redis: ${message}`);
	}

	// Fallback: read from MongoDB
	try {
		const docs = await StrategyConfigModel.find({ mode: config.mode });
		if (docs.length > 0) {
			const partial: Partial<StrategyConfig> = {};
			for (const doc of docs) {
				if (STRATEGY_KEYS.includes(doc.key as keyof StrategyConfig)) {
					(partial as any)[doc.key] = doc.value;
				}
			}
			const result = resolveStrategyConfig(partial);
			localCache = result;
			localCacheTime = Date.now();
			logger.info(`Loaded ${config.mode} strategy config from MongoDB (Redis miss)`);
			return result;
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		logger.error(`Failed to read strategy config from MongoDB: ${message}`);
	}

	// Fallback to defaults
	const defaults = resolveStrategyConfig({});
	localCache = defaults;
	localCacheTime = Date.now();
	return defaults;
}

/**
 * Force-refresh the local cache on next call.
 */
export function invalidateLocalCache(): void {
	localCache = null;
	localCacheTime = 0;
}
