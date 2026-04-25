/**
 * Redis Key Constants
 * Centralized key definitions to ensure consistency between bot and API.
 */

import { TradeType } from './types';

export const REDIS_PREFIX = 'pmbot:';

export const REDIS_KEYS = {
	// All keys are now mode-specific
	BTC_PRICE: (mode: TradeType) => `${REDIS_PREFIX}${mode}:btc_price`,
	REF_PRICE: (mode: TradeType) => `${REDIS_PREFIX}${mode}:ref_price`,
	MARKET_PRICES: (mode: TradeType) => `${REDIS_PREFIX}${mode}:market_prices`,
	SIGNAL: (mode: TradeType) => `${REDIS_PREFIX}${mode}:signal`,
	STRATEGY_CONFIG: (mode: TradeType) =>
		`${REDIS_PREFIX}${mode}:strategy_config`,
	NOTIFICATION_CONFIG: (mode: TradeType) =>
		`${REDIS_PREFIX}${mode}:notification_config`,
	BOT_VERSION: (mode: TradeType) => `${REDIS_PREFIX}${mode}:bot_version`,
	THROTTLE: (mode: TradeType, type: string, hash: string) =>
		`${REDIS_PREFIX}${mode}:throttle:${type}:${hash}`,
	BALANCE: (mode: TradeType) => `${REDIS_PREFIX}${mode}:balance`,
	STATS: (mode: TradeType) => `${REDIS_PREFIX}${mode}:stats`,
	HISTORY_IDS: (mode: TradeType) => `${REDIS_PREFIX}${mode}:history_ids`,
	START_TIME: (mode: TradeType) => `${REDIS_PREFIX}${mode}:start_time`,
	STOP_REQUESTED: (mode: TradeType) =>
		`${REDIS_PREFIX}${mode}:stop_requested`,
	DAILY_STOP: (mode: TradeType) => `${REDIS_PREFIX}${mode}:daily_stop`, // persists { stopped: boolean, date: string }
	DAILY_PNL: (mode: TradeType, date: string) =>
		`${REDIS_PREFIX}${mode}:daily_pnl:${date}`,
	ACTIVE_TRADES: (mode: TradeType) => `${REDIS_PREFIX}${mode}:active_trades`,
	AWAITING_RESOLVE_TRADES: (mode: TradeType) =>
		`${REDIS_PREFIX}${mode}:awaiting_resolve_trades`,
	TRADE_PREFIX: (mode: TradeType) => `${REDIS_PREFIX}${mode}:trade:`, // followed by trade ID
};

/**
 * Helper to get the trade key
 */
export function getTradeKey(mode: TradeType, tradeId: string): string {
	return `${REDIS_KEYS.TRADE_PREFIX(mode)}${tradeId}`;
}
