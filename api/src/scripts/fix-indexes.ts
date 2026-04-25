import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.production.local'), override: true });

import config from '../config';

async function fix() {
	try {
		console.log('🚀 Connecting to MongoDB...');
		await mongoose.connect(config.mongoUri);
		console.log('✅ Connected');

		const db = mongoose.connection.db;
		if (!db) throw new Error('Database connection failed');

		// 1. Fix StrategyConfigs
		console.log('\n🛠️  Checking StrategyConfigs indexes...');
		const strategyColl = db.collection('strategyconfigs');
		const strategyIndexes = await strategyColl.indexes();
		console.log('Current indexes:', strategyIndexes.map(i => i.name));

		if (strategyIndexes.find(i => i.name === 'key_1')) {
			console.log('🗑️  Dropping old unique index key_1...');
			await strategyColl.dropIndex('key_1');
			console.log('✅ Dropped key_1');
		}

		// 2. Fix NotificationConfigs
		console.log('\n🛠️  Checking NotificationConfigs indexes...');
		const notificationColl = db.collection('notificationconfigs');
		const notificationIndexes = await notificationColl.indexes();
		console.log('Current indexes:', notificationIndexes.map(i => i.name));

		if (notificationIndexes.find(i => i.name === 'key_1')) {
			console.log('🗑️  Dropping old unique index key_1...');
			await notificationColl.dropIndex('key_1');
			console.log('✅ Dropped key_1');
		}

		console.log('\n🎉 Index cleanup completed!');
		process.exit(0);
	} catch (error) {
		console.error('\n❌ Cleanup failed:', error);
		process.exit(1);
	}
}

fix();
