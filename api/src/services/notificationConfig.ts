import {
	DEFAULT_NOTIFICATION_CONFIG,
	REDIS_KEYS,
	type NotificationConfig,
	type TradeType,
} from '../../../shared/src/index';
import { NotificationConfigModel } from '../models/NotificationConfig';
import { redis } from './redis';

const CONFIG_KEYS = Object.keys(
	DEFAULT_NOTIFICATION_CONFIG,
) as (keyof NotificationConfig)[];

/**
 * Get the full notification configuration. Uses Redis cache first, falls back to MongoDB.
 */
export async function getNotificationConfig(mode: TradeType): Promise<NotificationConfig> {
	const cacheKey = REDIS_KEYS.NOTIFICATION_CONFIG(mode);

	// Try cache first
	const cached = await redis.get(cacheKey);
	if (cached) {
		return JSON.parse(cached) as NotificationConfig;
	}

	// Read from MongoDB
	const docs = await NotificationConfigModel.find({ mode });
	const partial: Partial<NotificationConfig> = {};

	for (const doc of docs) {
		if (CONFIG_KEYS.includes(doc.key as keyof NotificationConfig)) {
			(partial as any)[doc.key] = doc.value;
		}
	}

	// Merge with defaults
	const result = { ...DEFAULT_NOTIFICATION_CONFIG, ...partial };

	// Write to cache
	await redis.set(cacheKey, JSON.stringify(result));

	return result;
}

/**
 * Update notification config values. Only updates the keys provided.
 * Invalidates the Redis cache after updating.
 */
export async function updateNotificationConfig(
	mode: TradeType,
	updates: Partial<NotificationConfig>,
): Promise<NotificationConfig> {
	const ops = Object.entries(updates)
		.filter(([key]) => CONFIG_KEYS.includes(key as keyof NotificationConfig))
		.map(([key, value]) => ({
			updateOne: {
				filter: { key, mode },
				update: { $set: { value } },
				upsert: true,
			},
		}));

	if (ops.length > 0) {
		await NotificationConfigModel.bulkWrite(ops);
	}

	// Invalidate cache
	await redis.del(REDIS_KEYS.NOTIFICATION_CONFIG(mode));

	return getNotificationConfig(mode);
}

/**
 * Add a Telegram chat ID to the subscription list.
 */
export async function addTelegramChatId(mode: TradeType, chatId: string): Promise<void> {
	await NotificationConfigModel.findOneAndUpdate(
		{ key: 'telegram_chat_ids', mode },
		{ $addToSet: { value: chatId } },
		{ upsert: true },
	);
	await redis.del(REDIS_KEYS.NOTIFICATION_CONFIG(mode));
}

/**
 * Remove a Telegram chat ID from the subscription list.
 */
export async function removeTelegramChatId(mode: TradeType, chatId: string): Promise<void> {
	await NotificationConfigModel.findOneAndUpdate(
		{ key: 'telegram_chat_ids', mode },
		{ $pull: { value: chatId } },
	);
	await redis.del(REDIS_KEYS.NOTIFICATION_CONFIG(mode));
}

/**
 * Get all subscribed Telegram chat IDs.
 */
export async function getTelegramChatIds(mode: TradeType): Promise<string[]> {
	const doc = await NotificationConfigModel.findOne({
		key: 'telegram_chat_ids',
		mode,
	});
	return Array.isArray(doc?.value) ? doc.value : [];
}

/**
 * Add a Telegram chat ID to the authenticated list.
 */
export async function addAuthenticatedChatId(mode: TradeType, chatId: string): Promise<void> {
	await NotificationConfigModel.findOneAndUpdate(
		{ key: 'authenticated_chats', mode },
		{ $addToSet: { value: chatId } },
		{ upsert: true },
	);
	await redis.del(REDIS_KEYS.NOTIFICATION_CONFIG(mode));
}

/**
 * Remove a Telegram chat ID from the authenticated list.
 */
export async function removeAuthenticatedChatId(mode: TradeType, chatId: string): Promise<void> {
	await NotificationConfigModel.findOneAndUpdate(
		{ key: 'authenticated_chats', mode },
		{ $pull: { value: chatId } },
	);
	await redis.del(REDIS_KEYS.NOTIFICATION_CONFIG(mode));
}

/**
 * Check if a chat ID is authenticated.
 */
export async function isAuthenticatedChatId(mode: TradeType, chatId: string): Promise<boolean> {
	const config = await getNotificationConfig(mode);
	return config.authenticated_chats?.includes(chatId) || false;
}
