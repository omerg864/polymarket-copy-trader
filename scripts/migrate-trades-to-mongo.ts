/**
 * Migration Script: Redis List to MongoDB + Redis Set
 * Uses existing bot services to ensure consistent logic and imports.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env from btc5-bot
dotenv.config({ path: path.resolve(__dirname, '..', 'btc5-bot', '.env') });

import Redis from 'ioredis';
import mongoose from 'mongoose';

// Attempting to import via the provided shared file as requested
import * as RedisKeysModule from '../shared/src/redisKeys';
const REDIS_KEYS = (RedisKeysModule as any).REDIS_KEYS;

import { type Trade } from '../shared/src/types';
import { tradeService } from '../btc5-bot/src/services/tradeService';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/polymarket-bot';

async function migrate(mode: 'demo' | 'live', redis: Redis) {
	if (!REDIS_KEYS) {
		console.error('ERROR: REDIS_KEYS not found in imported module.');
		return;
	}

	console.log(`\n--- Migrating ${mode} trades ---`);
	const historyKey = REDIS_KEYS.HISTORY(mode);
	const records = await redis.lrange(historyKey, 0, -1);
	console.log(`Found ${records.length} trades in Redis LIST (${historyKey})`);

	if (records.length === 0) return;

	let migratedCount = 0;
	for (const raw of records) {
		try {
			const trade = JSON.parse(raw) as Trade;
			await tradeService.saveTradeHistory(trade);
			migratedCount++;
			if (migratedCount % 10 === 0) process.stdout.write('.');
		} catch (err) {
			console.error(`\nFailed to migrate trade: ${err}`);
		}
	}
	console.log(`\nMigration completed for ${mode}: ${migratedCount} migrated.`);
}

async function main() {
	console.log('Starting migration...');
	
	// Basic check to see if imports worked
	if (!REDIS_KEYS) {
		console.error('Failed to resolve REDIS_KEYS. Check imports.');
		process.exit(1);
	}

	await mongoose.connect(MONGO_URI);
	console.log('Connected to MongoDB');
	const redis = new Redis(REDIS_URL);
	console.log('Connected to Redis');

	try {
		await migrate('demo', redis);
		await migrate('live', redis);
		console.log('\nMigration finished successfully!');
	} finally {
		await redis.quit();
		await mongoose.disconnect();
	}
}

main().catch(console.error);
