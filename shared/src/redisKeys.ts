/**
 * Redis Key Constants
 * Centralized key definitions to ensure consistency between bot and API.
 */

import { TradeType } from './types';

export const REDIS_PREFIX = 'pmbot:';

export const REDIS_KEYS = {
	// Global / Shared (Truly global, independent of demo/live)
	BTC_PRICE: `${REDIS_PREFIX}btc_price`,
	REF_PRICE: `${REDIS_PREFIX}ref_price`,
	MARKET_PRICES: `${REDIS_PREFIX}market_prices`,
	SIGNAL: `${REDIS_PREFIX}signal`,
	STRATEGY_CONFIG: `${REDIS_PREFIX}strategy_config`,
	NOTIFICATION_CONFIG: `${REDIS_PREFIX}notification_config`,
	BOT_VERSION: `${REDIS_PREFIX}bot_version`,
	THROTTLE: (type: string, hash: string) =>
		`${REDIS_PREFIX}throttle:${type}:${hash}`,

	// Mode-specific (demo/live)
	BALANCE: (mode: TradeType) => `${REDIS_PREFIX}${mode}:balance`,
	STATS: (mode: TradeType) => `${REDIS_PREFIX}${mode}:stats`,
	HISTORY_IDS: (mode: TradeType) => `${REDIS_PREFIX}${mode}:history_ids`,
	START_TIME: (mode: TradeType) => `${REDIS_PREFIX}${mode}:start_time`,
	STOP_REQUESTED: (mode: TradeType) => `${REDIS_PREFIX}${mode}:stop_requested`,
	DAILY_STOP: (mode: TradeType) => `${REDIS_PREFIX}${mode}:daily_stop`, // persists { stopped: boolean, date: string }
	DAILY_PNL: (mode: TradeType, date: string) =>
		`${REDIS_PREFIX}${mode}:daily_pnl:${date}`,
	ACTIVE_TRADES: (mode: TradeType) => `${REDIS_PREFIX}${mode}:active_trades`,
	AWAITING_RESOLVE_TRADES: (mode: TradeType) => `${REDIS_PREFIX}${mode}:awaiting_resolve_trades`,
	TRADE_PREFIX: (mode: TradeType) => `${REDIS_PREFIX}${mode}:trade:`, // followed by trade ID
};

/**
 * Helper to get the trade key
 */
export function getTradeKey(mode: TradeType, tradeId: string): string {
	return `${REDIS_KEYS.TRADE_PREFIX(mode)}${tradeId}`;
}
