import { resolveStrategyConfig, type StrategyConfig } from '@shared/types';
import logger from '../utils/logger';
import redisService from './redis';

const CACHE_KEY = 'pmbot:strategy_config';
const LOCAL_TTL_MS = 10_000; // 10 seconds local cache

let localCache: StrategyConfig | null = null;
let localCacheTime = 0;

/**
 * Get strategy config from Redis (written by the API service).
 * Uses a 10-second local in-memory cache to avoid hammering Redis every call.
 * Falls back to DEFAULT_STRATEGY_CONFIG if Redis has no data.
 */
export async function getStrategyConfig(): Promise<StrategyConfig> {
	// Local in-memory cache first
	if (localCache && Date.now() - localCacheTime < LOCAL_TTL_MS) {
		return localCache;
	}

	try {
		const raw = await redisService.getRaw(CACHE_KEY);
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
