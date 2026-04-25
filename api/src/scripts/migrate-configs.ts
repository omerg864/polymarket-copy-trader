import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load production environment if available
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.production.local'), override: true });
import config from '../config';
import { StrategyConfigModel } from '../models/StrategyConfig';
import { NotificationConfigModel } from '../models/NotificationConfig';
import { TradeType } from '../../../shared/src/types';
import Redis from 'ioredis';

async function migrate() {
	try {
		console.log('🚀 Starting configuration migration...');
		
		await mongoose.connect(config.mongoUri);
		console.log('✅ Connected to MongoDB');

		const redis = new Redis(config.redisUrl);
		console.log('✅ Connected to Redis');

		// 1. Update StrategyConfig docs
		const strategyCount = await StrategyConfigModel.countDocuments({ mode: { $exists: false } });
		if (strategyCount > 0) {
			console.log(`Migrating ${strategyCount} StrategyConfig documents to 'demo' mode...`);
			await StrategyConfigModel.updateMany(
				{ mode: { $exists: false } },
				{ $set: { mode: TradeType.DEMO } }
			);
		}

		// 2. Update NotificationConfig docs
		const notificationCount = await NotificationConfigModel.countDocuments({ mode: { $exists: false } });
		if (notificationCount > 0) {
			console.log(`Migrating ${notificationCount} NotificationConfig documents to 'demo' mode...`);
			await NotificationConfigModel.updateMany(
				{ mode: { $exists: false } },
				{ $set: { mode: TradeType.DEMO } }
			);
		}

		// 3. Clear Redis cache to force reload with new keys
		console.log('🧹 Clearing Redis cache for configurations...');
		const keys = await redis.keys('pmbot:*config*');
		if (keys.length > 0) {
			await redis.del(...keys);
			console.log(`Removed ${keys.length} legacy config keys from Redis`);
		}

		console.log('🎉 Migration completed successfully!');
		process.exit(0);
	} catch (error) {
		console.error('❌ Migration failed:', error);
		process.exit(1);
	}
}

migrate();
