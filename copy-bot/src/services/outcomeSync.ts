import tradeService from './tradeService';
import polymarketService from './polymarket';
import logger from '../utils/logger';
import { TradeStatus, type Trade } from '@shared/types';
import notificationManager from './notificationManager';

class OutcomeSyncService {
	private interval: NodeJS.Timeout | null = null;
	private isSyncing = false;

	/**
	 * Starts the background sync task.
	 * Runs every 20 minutes.
	 */
	start(): void {
		if (this.interval) return;

		const intervalMs = 20 * 60 * 1000; // 20 minutes
		this.interval = setInterval(() => this.syncOutcomes(), intervalMs);

		logger.info('🔄 Outcome Sync Service started (every 20m)');

		// Run once on start after a short delay
		setTimeout(() => this.syncOutcomes(), 5000);
	}

	stop(): void {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
	}

	private async syncOutcomes(): Promise<void> {
		if (this.isSyncing) return;
		this.isSyncing = true;

		try {
			logger.info('🔄 Checking for trades without actual outcomes...');
			const historyTrades = await tradeService.getTradeHistory(100);
			const tradesToUpdate = historyTrades.filter(
				(t: Trade) => !t.actualOutcome || t.actualOutcome === 'UNKNOWN',
			);

			if (tradesToUpdate.length === 0) {
				logger.debug('✅ All historical trades have outcomes.');
				return;
			}

			logger.info(`🔍 Found ${tradesToUpdate.length} trades to sync.`);

			for (const trade of tradesToUpdate) {
				try {
					// Use the logic from sync script to get outcome
					let actualOutcome: Trade['actualOutcome'] = 'UNKNOWN';
					// Fetch from Gamma API
					const marketOutcome =
						await polymarketService.getMarketOutcome(
							trade.eventTicker,
						);
					if (marketOutcome) {
						actualOutcome = marketOutcome as Trade['actualOutcome'];
					}

					if (actualOutcome !== 'UNKNOWN') {
						await tradeService.updateTradeInHistory({
							actualOutcome,
							id: trade.id,
						});
						logger.info(
							`✅ Updated outcome for trade ${trade.id}: ${actualOutcome}`,
						);
						if (
							actualOutcome !== trade.direction &&
							trade.status === TradeStatus.WON
						) {
							logger.error(
								`❌ Trade ${trade.id} has wrong outcome: ${actualOutcome}`,
							);
							notificationManager.handleError(
								new Error(
									`Trade ${trade.id} has wrong outcome: ${actualOutcome}`,
								),
								'OutcomeSyncService',
								'syncOutcomes',
							);
						}
					}
				} catch (err) {
					logger.error(
						`Failed to sync outcome for trade ${trade.id}: ${err}`,
					);
				}
			}
		} catch (error) {
			logger.error(`Outcome sync error: ${error}`);
		} finally {
			this.isSyncing = false;
		}
	}
}

const outcomeSyncService = new OutcomeSyncService();
export default outcomeSyncService;
