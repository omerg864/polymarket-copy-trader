import dotenv from 'dotenv';
import path from 'path';

// Resolve .env path relative to this script's directory in CommonJS
// Script is in src/scripts/, .env is in btc5-bot/ root (2 levels up)
dotenv.config({ path: path.resolve(__dirname, '../../.env.production.local') });
import Redis from 'ioredis';
import config from '../config';
import { REDIS_KEYS } from '../../../shared/src/redisKeys';

/**
 * Migration script: Convert HISTORY_IDS from Set to Sorted Set (ZSET).
 * Run this before deploying the updated bot code.
 */
async function migrateHistoryToZset() {
	const redis = new Redis(config.redisUrl);
	const modes = ['live', 'demo'] as const;

	console.log('🚀 Starting Redis history migration (Set -> ZSET)...');

	try {
		for (const mode of modes) {
			const key = REDIS_KEYS.HISTORY_IDS(mode);
			const type = await redis.type(key);

			if (type === 'set') {
				console.log(`📦 Found Set at ${key}. Migrating...`);

				// 1. Fetch all members
				const members = await redis.smembers(key);
				console.log(`   - Found ${members.length} members.`);

				if (members.length > 0) {
					// 2. Delete original set
					await redis.del(key);

					// 3. Re-add as ZSET
					// Using current timestamp as score since order was lost anyway in Set.
					// We'll add them with slightly incrementing scores to maintain some insertion hint
					// though it doesn't strictly matter for the initial migration.
					const now = Date.now();
					const pipeline = redis.pipeline();
					members.forEach((member, index) => {
						pipeline.zadd(key, now + index, member);
					});
					await pipeline.exec();

					console.log(
						`   - ✅ Successfully converted ${key} to ZSET.`,
					);
				} else {
					// Just delete and let it be created as ZSET later
					await redis.del(key);
					console.log(`   - ✅ Empty set deleted.`);
				}
			} else if (type === 'zset') {
				console.log(`ℹ️  Key ${key} is already a ZSET. Skipping.`);
			} else if (type === 'none') {
				console.log(`ℹ️  Key ${key} does not exist. Skipping.`);
			} else {
				console.warn(
					`⚠️  Key ${key} has unexpected type: ${type}. Skipping.`,
				);
			}
		}

		console.log('\n✨ Migration completed successfully.');
	} catch (error) {
		console.error('\n❌ Migration failed:', error);
		process.exit(1);
	} finally {
		await redis.quit();
	}
}

migrateHistoryToZset().catch(console.error);
