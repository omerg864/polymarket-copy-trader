import {
	DEFAULT_NOTIFICATION_CONFIG,
	type NotificationConfig,
} from '../../../shared/src/types';
import { NotificationConfigModel } from '../models/NotificationConfig';
import { redis } from './redis';

const CACHE_KEY = 'pmbot:notification_config';

const CONFIG_KEYS = Object.keys(
	DEFAULT_NOTIFICATION_CONFIG,
) as (keyof NotificationConfig)[];

/**
 * Get the full notification configuration. Uses Redis cache first, falls back to MongoDB.
 */
export async function getNotificationConfig(): Promise<NotificationConfig> {
	// Try cache first
	const cached = await redis.get(CACHE_KEY);
	if (cached) {
		return JSON.parse(cached) as NotificationConfig;
	}

	// Read from MongoDB
	const docs = await NotificationConfigModel.find({});
	const partial: Partial<NotificationConfig> = {};

	for (const doc of docs) {
		if (CONFIG_KEYS.includes(doc.key as keyof NotificationConfig)) {
			(partial as any)[doc.key] = doc.value;
		}
	}

	// Merge with defaults
	const result = { ...DEFAULT_NOTIFICATION_CONFIG, ...partial };

	// Write to cache
	await redis.set(CACHE_KEY, JSON.stringify(result));

	return result;
}

/**
 * Update notification config values. Only updates the keys provided.
 * Invalidates the Redis cache after updating.
 */
export async function updateNotificationConfig(
	updates: Partial<NotificationConfig>,
): Promise<NotificationConfig> {
	const ops = Object.entries(updates)
		.filter(([key]) => CONFIG_KEYS.includes(key as keyof NotificationConfig))
		.map(([key, value]) => ({
			updateOne: {
				filter: { key },
				update: { $set: { value } },
				upsert: true,
			},
		}));

	if (ops.length > 0) {
		await NotificationConfigModel.bulkWrite(ops);
	}

	// Invalidate cache
	await redis.del(CACHE_KEY);

	return getNotificationConfig();
}

/**
 * Add a Telegram chat ID to the subscription list.
 */
export async function addTelegramChatId(chatId: string): Promise<void> {
	await NotificationConfigModel.findOneAndUpdate(
		{ key: 'telegram_chat_ids' },
		{ $addToSet: { value: chatId } },
		{ upsert: true },
	);
	await redis.del(CACHE_KEY);
}

/**
 * Remove a Telegram chat ID from the subscription list.
 */
export async function removeTelegramChatId(chatId: string): Promise<void> {
	await NotificationConfigModel.findOneAndUpdate(
		{ key: 'telegram_chat_ids' },
		{ $pull: { value: chatId } },
	);
	await redis.del(CACHE_KEY);
}

/**
 * Get all subscribed Telegram chat IDs.
 */
export async function getTelegramChatIds(): Promise<string[]> {
	const doc = await NotificationConfigModel.findOne({
		key: 'telegram_chat_ids',
	});
	return Array.isArray(doc?.value) ? doc.value : [];
}
