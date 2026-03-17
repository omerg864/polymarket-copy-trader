/**
 * Redis Key Constants
 * Centralized key definitions to ensure consistency between bot and API.
 */

export const REDIS_PREFIX = 'pmbot:';

export const REDIS_KEYS = {
	// Global / Shared (Truly global, independent of demo/live)
	BTC_PRICE: `${REDIS_PREFIX}btc_price`,
	REF_PRICE: `${REDIS_PREFIX}ref_price`,
	STRATEGY_CONFIG: `${REDIS_PREFIX}strategy_config`,
	NOTIFICATION_CONFIG: `${REDIS_PREFIX}notification_config`,
	
	// Mode-specific (demo/live)
	BALANCE: (mode: string) => `${REDIS_PREFIX}${mode}:balance`,
	STATS: (mode: string) => `${REDIS_PREFIX}${mode}:stats`,
	HISTORY: (mode: string) => `${REDIS_PREFIX}${mode}:history`,
	HISTORY_IDS: (mode: string) => `${REDIS_PREFIX}${mode}:history_ids`,
	START_TIME: (mode: string) => `${REDIS_PREFIX}${mode}:start_time`,
	STOP_REQUESTED: (mode: string) => `${REDIS_PREFIX}${mode}:stop_requested`,
	DAILY_STOP: (mode: string) => `${REDIS_PREFIX}${mode}:daily_stop`, // persists { stopped: boolean, date: string }
	DAILY_PNL: (mode: string, date: string) => `${REDIS_PREFIX}${mode}:daily_pnl:${date}`,
	ACTIVE_TRADES: (mode: string) => `${REDIS_PREFIX}${mode}:active_trades`,
	TRADE_PREFIX: (mode: string) => `${REDIS_PREFIX}${mode}:trade:`, // followed by trade ID
};

/**
 * Helper to get the trade key
 */
export function getTradeKey(mode: string, tradeId: string): string {
    return `${REDIS_KEYS.TRADE_PREFIX(mode)}${tradeId}`;
}
