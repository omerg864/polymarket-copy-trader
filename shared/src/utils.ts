import { DateTime } from 'luxon';
import type { Trade } from './types';

/**
 * Calculate Polymarket taker fee for crypto markets.
 * Formula: fee = shares × price × feeRate × (price × (1 - price))^exponent
 * Crypto: feeRate = 0.0175, exponent = 1
 */
export function calculateFee(shares: number, price: number): number {
	const FEE_RATE = 0.0175;
	const EXPONENT = 1;
	const raw =
		shares * price * FEE_RATE * Math.pow(price * (1 - price), EXPONENT);
	return Math.round(raw * 10000) / 10000; // 4 decimal precision
}

/**
 * Sums PnL for all trades whose enteredAt falls on today (UTC).
 * If currentTrade is provided and not already present in history,
 * its pnl is added as a fallback (useful when called mid-close before
 * the trade has been persisted).
 */
export function calculateTodayPnl(
	history: Trade[],
	currentTrade?: Trade,
): number {
	const startOfToday = DateTime.now()
		.setZone('Asia/Jerusalem')
		.startOf('day');
	const todayTrades = history.filter((t) => {
		if (!t.enteredAt) return false;
		const enteredAt = DateTime.fromISO(t.enteredAt);
		return enteredAt >= startOfToday;
	});
	const total = todayTrades.reduce((sum, t) => sum + t.pnl, 0);
	if (currentTrade) {
		const alreadyIncluded = todayTrades.some(
			(t) => t.id === currentTrade.id,
		);
		return alreadyIncluded ? total : total + currentTrade.pnl;
	}
	return total;
}
