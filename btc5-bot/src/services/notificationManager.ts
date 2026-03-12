import config from '../config';
import logger from '../utils/logger';

export class NotificationManager {
	/**
	 * Trigger a notification to the dashboard server.
	 * Runs asynchronously in the background.
	 */
	static trigger(type: 'win' | 'loss' | 'goal' | 'manual', data: any): void {
		if (!config.apiUrl || !config.apiPassword) {
			logger.debug('Skipping notification: API URL or Password not configured');
			return;
		}

		// Run in background
		(async () => {
			try {
				const response = await fetch(`${config.apiUrl}/api/notifications/notify`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'x-api-password': config.apiPassword,
					},
					body: JSON.stringify({ type, data }),
				});

				if (!response.ok) {
					const errorText = await response.text();
					logger.error(`Failed to trigger notification: ${response.statusText} - ${errorText}`);
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				logger.error(`Error triggering notification: ${message}`);
			}
		})();
	}
}

export default NotificationManager;
