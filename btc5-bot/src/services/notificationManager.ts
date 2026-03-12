import { type Trade } from '@shared/types';
import config from '../config';
import { getStrategyConfig } from './strategyConfig';
import logger from '../utils/logger';

export class NotificationManager {
	/**
	 * Trigger a notification to the dashboard server.
	 * Runs asynchronously in the background.
	 */
	static trigger(type: 'win' | 'loss' | 'goal' | 'manual', data: any): void {
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
	 * Centralized handler for trade closure notifications.
	 * Decides whether to send win/loss alert and checks for daily goal achievement.
	 */
	static async handleTradeClosed(trade: Trade, stats: any): Promise<void> {
		const sc = await getStrategyConfig();

		// Trigger win/loss notification in background
		this.trigger(trade.pnl >= 0 ? 'win' : 'loss', {
			title: trade.title,
			pnl: trade.pnl,
			pctChange:
				trade.pctChange || (trade.cost > 0 ? trade.pnl / trade.cost : 0),
			exitPrice: trade.exitPrice,
		});

		// Check for daily P&L goal achievement
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
	}
}

export default NotificationManager;
