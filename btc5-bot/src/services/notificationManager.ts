import {
	BotStats,
	NotificationType,
	type NotificationConfig,
	type Trade,
} from '@shared/types';
import config from '../config';
import { getStrategyConfig } from './strategyConfig';
import redisService from './redis';
import logger from '../utils/logger';

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
	 * Centralized handler for trade closure notifications.
	 * Decides whether to send win/loss alert and checks for daily goal achievement.
	 */
	static async handleTradeClosed(
		trade: Trade,
		stats: BotStats,
	): Promise<void> {
		const sc = await getStrategyConfig();
		const nc = await this.getNotificationConfig();

		// Trigger win/loss notification in background
		this.trigger(trade.pnl >= 0 ? 'win' : 'loss', {
			title: trade.title,
			pnl: trade.pnl,
			todayPnl: stats.totalPnl,
			pctChange:
				trade.pctChange ||
				(trade.cost > 0 ? trade.pnl / trade.cost : 0),
			exitPrice: trade.exitPrice,
		});

		// Check for daily P&L goal achievement (from Strategy Config)
		if (
			sc.dayPnlGoal > 0 &&
			stats.totalPnl >= sc.dayPnlGoal &&
			stats.totalPnl - trade.pnl < sc.dayPnlGoal
		) {
			this.trigger('goal', {
				todayPnl: stats.totalPnl,
				goal: sc.dayPnlGoal,
				totalTrades: stats.totalTrades,
			});
		}

		// Check for Min/Max daily P&L bounds (from Notification Config)
		if (nc) {
			// Min Bound (Losses) - only if configured < 0
			if (
				nc.minTodayPnLNotification < 0 &&
				stats.totalPnl <= nc.minTodayPnLNotification &&
				stats.totalPnl - trade.pnl > nc.minTodayPnLNotification
			) {
				this.trigger('min_pnl', {
					todayPnl: stats.totalPnl,
					min: nc.minTodayPnLNotification,
					totalTrades: stats.totalTrades,
				});
			}

			// Max Bound (Wins) - only if configured > 0
			if (
				nc.maxTodayPnLNotification > 0 &&
				stats.totalPnl >= nc.maxTodayPnLNotification &&
				stats.totalPnl - trade.pnl < nc.maxTodayPnLNotification
			) {
				this.trigger('max_pnl', {
					todayPnl: stats.totalPnl,
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
