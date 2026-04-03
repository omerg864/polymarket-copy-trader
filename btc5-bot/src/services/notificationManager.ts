import {
	BotStats,
	NotificationType,
	REDIS_KEYS,
	type NotificationConfig,
	type Trade,
} from '@shared/index';
import { DateTime } from 'luxon';
import crypto from 'crypto';
import config from '../config';
import logger from '../utils/logger';
import redisService from './redis';
import { getStrategyConfig } from './strategyConfig';

export class NotificationManager {
	/**
	 * Trigger a notification to the dashboard server.
	 * Runs asynchronously in the background.
	 */
	static trigger(type: NotificationType, data: any): void {
		if (!config.apiUrl || !config.apiPassword) {
			logger.debug(
				'Skipping notification: API URL or Password not configured',
			);
			return;
		}

		// Run in background
		(async () => {
			try {
				// Throttle logic: prevent sending the same notification within 3 minutes
				const dataHash = crypto
					.createHash('md5')
					.update(JSON.stringify(data))
					.digest('hex');
				const throttleKey = REDIS_KEYS.THROTTLE(type, dataHash);
				const isNew = await redisService.checkThrottle(
					throttleKey,
					180,
				);

				if (!isNew) {
					logger.debug(
						`Throttling duplicate notification: ${type} (${dataHash.slice(0, 8)})`,
					);
					return;
				}

				const response = await fetch(
					`${config.apiUrl}/api/notifications/notify`,
					{
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'x-api-password': config.apiPassword,
						},
						body: JSON.stringify({ type, data }),
					},
				);

				if (!response.ok) {
					const errorText = await response.text();
					logger.error(
						`Failed to trigger notification: ${response.statusText} - ${errorText}`,
					);
				}
			} catch (error) {
				const message =
					error instanceof Error ? error.message : String(error);
				logger.error(`Error triggering notification: ${message}`);
			}
		})();
	}

	/**
	 * Fetch NotificationConfig directly from Redis cache.
	 */
	private static async getNotificationConfig(): Promise<NotificationConfig | null> {
		try {
			const data = await redisService.getRaw('pmbot:notification_config');
			return data ? JSON.parse(data) : null;
		} catch (err) {
			return null;
		}
	}

	/**
	 * Centralized handler for new trade entry notifications.
	 */
	static async handleTradeOpened(trade: Trade): Promise<void> {
		this.trigger('trade', {
			title: trade.title,
			direction: trade.direction,
			size: trade.size,
			entryPrice: trade.entryPrice,
			confidence: trade.confidence,
		});
	}

	/**
	 * Centralized handler for trade closure notifications.
	 * Decides whether to send win/loss alert and checks for daily goal achievement.
	 */
	static async handleTradeClosed(
		trade: Trade,
		stats: BotStats,
		balance: number,
	): Promise<void> {
		const sc = await getStrategyConfig();
		const nc = await this.getNotificationConfig();
		// Use trade's enteredAt for consistent daily stats attribution in notifications
		const baseDate = trade.enteredAt
			? DateTime.fromISO(trade.enteredAt)
			: DateTime.now();
		const todayStr = baseDate.setZone(sc.timezone).toISODate() || '';
		const dailyStats = await redisService.getDailyStats(todayStr);
		const todayPnl = dailyStats.pnl;

		// Trigger win/loss notification in background
		this.trigger(trade.pnl >= 0 ? 'win' : 'loss', {
			title: trade.title,
			pnl: trade.pnl,
			todayPnl,
			todayWins: dailyStats.wins,
			todayLosses: dailyStats.losses,
			pctChange:
				trade.pctChange ||
				(trade.cost > 0 ? trade.pnl / trade.cost : 0),
			exitPrice: trade.exitPrice,
			balance: balance,
			status: trade.status,
		});

		// Check for daily P&L goal achievement (from Strategy Config)
		if (
			sc.dayPnlGoal > 0 &&
			todayPnl >= sc.dayPnlGoal &&
			todayPnl - trade.pnl < sc.dayPnlGoal
		) {
			this.trigger('goal', {
				todayPnl,
				todayWins: dailyStats.wins,
				todayLosses: dailyStats.losses,
				goal: sc.dayPnlGoal,
				totalTrades: stats.totalTrades,
			});
		}

		// Check for Min/Max daily P&L bounds (from Notification Config)
		if (nc) {
			// Min Bound (Losses) - only if configured < 0
			if (
				nc.minTodayPnLNotification < 0 &&
				todayPnl <= nc.minTodayPnLNotification &&
				todayPnl - trade.pnl > nc.minTodayPnLNotification
			) {
				this.trigger('min_pnl', {
					todayPnl,
					todayWins: dailyStats.wins,
					todayLosses: dailyStats.losses,
					min: nc.minTodayPnLNotification,
					totalTrades: stats.totalTrades,
				});
			}

			// Max Bound (Wins) - only if configured > 0
			if (
				nc.maxTodayPnLNotification > 0 &&
				todayPnl >= nc.maxTodayPnLNotification &&
				todayPnl - trade.pnl < nc.maxTodayPnLNotification
			) {
				this.trigger('max_pnl', {
					todayPnl,
					todayWins: dailyStats.wins,
					todayLosses: dailyStats.losses,
					max: nc.maxTodayPnLNotification,
					totalTrades: stats.totalTrades,
				});
			}
		}
	}

	/**
	 * Centralized handler for bot errors.
	 */
	static async handleError(
		error: any,
		service: string = 'Bot',
		context?: string,
	): Promise<void> {
		const nc = await this.getNotificationConfig();

		if (nc?.notificationOnError) {
			const message =
				error instanceof Error ? error.message : String(error);
			this.trigger('error', {
				service,
				message,
				context,
			});
		}
	}
}

export default NotificationManager;
