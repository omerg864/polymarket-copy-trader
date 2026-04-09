/**
 * Migration Script: Redis List to MongoDB + Redis Set
 * Optimized for production execution with robust environment loading.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load production environment (matching verify-stats.ts pattern)
dotenv.config({
	path: path.resolve(__dirname, '..', 'btc5-bot', '.env.production.local'),
});

import Redis from 'ioredis';
import mongoose, { Schema } from 'mongoose';

// Constants defined locally for robustness in standalone script
const REDIS_PREFIX = 'pmbot:';
const REDIS_KEYS = {
	HISTORY: (mode: string) => `${REDIS_PREFIX}${mode}:history`,
	HISTORY_IDS: (mode: string) => `${REDIS_PREFIX}${mode}:history_ids`,
};

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/polymarket-bot';

// Minimal Trade Schema for migration
const tradeSchema = new Schema(
	{
		tradeId: { type: String, required: true, unique: true, index: true },
		type: { type: String, enum: ['demo', 'live'], required: true, index: true },
		direction: { type: String, enum: ['UP', 'DOWN'], required: true },
		tokenId: { type: String, required: true },
		conditionId: { type: String, required: true },
		slug: { type: String },
		eventTicker: { type: String },
		title: { type: String },
		side: { type: String },
		entryPrice: { type: Number, required: true },
		currentPrice: { type: Number },
		exitPrice: { type: Number },
		exitBtcPrice: { type: Number },
		size: { type: Number, required: true },
		cost: { type: Number, required: true },
		fee: { type: Number, required: true },
		status: { type: String, required: true },
		startTime: { type: String, required: true },
		endTime: { type: String, required: true },
		enteredAt: { type: String, required: true },
		closedAt: { type: String, index: true },
		priceToBeat: { type: Number, required: true },
		pnl: { type: Number, required: true },
		pctChange: { type: Number },
		confidence: { type: Number },
		indicators: { type: Schema.Types.Mixed },
		actualOutcome: { type: String, enum: ['UP', 'DOWN', 'UNKNOWN'] },
	},
	{ timestamps: true }
);

const TradeModel = mongoose.models.Trade || mongoose.model('Trade', tradeSchema);

async function migrate(mode: 'demo' | 'live', redis: Redis) {
	console.log(`\n--- Migrating ${mode} trades ---`);
	const historyKey = REDIS_KEYS.HISTORY(mode);
	const idsKey = REDIS_KEYS.HISTORY_IDS(mode);

	const records = await redis.lrange(historyKey, 0, -1);
	console.log(`Found ${records.length} trades in Redis LIST (${historyKey})`);

	if (records.length === 0) return;

	let migratedCount = 0;
	for (const raw of records) {
		try {
			const trade = JSON.parse(raw);
			
			// Upsert into MongoDB
			await TradeModel.updateOne(
				{ tradeId: trade.id },
				{ $set: { ...trade, tradeId: trade.id, type: mode } },
				{ upsert: true }
			);

			// Add to Redis SET
			await redis.sadd(idsKey, trade.id);

			migratedCount++;
			if (migratedCount % 10 === 0) {
				process.stdout.write('.');
			}
		} catch (err) {
			console.error(`\nFailed to migrate trade: ${err}`);
		}
	}
	console.log(`\nMigration completed for ${mode}: ${migratedCount} migrated.`);
}

async function main() {
	console.log('🚀 Starting PRODUCTION migration...');
	console.log(`MONGO_URI: ${MONGO_URI}`);
	
	try {
		await mongoose.connect(MONGO_URI);
		console.log('Connected to MongoDB');

		const redis = new Redis(REDIS_URL);
		console.log('Connected to Redis');

		await migrate('demo', redis);
		await migrate('live', redis);
		
		console.log('\n✅ Migration finished successfully!');
		await redis.quit();
	} catch (err) {
		console.error('Migration failed:', err);
	} finally {
		await mongoose.disconnect();
	}
}

main().catch(console.error);
