import { DateTime } from 'luxon';
import type { Trade } from './types';

/**
 * Calculate Polymarket taker fee for crypto markets.
 * Formula: fee = shares × price × feeRate × (price × (1 - price))^exponent
 * Crypto: feeRate = 0.0175, exponent = 1
 */
export function calculateFee(shares: number, price: number): number {
	// Prices at absolute extremes (0 or 1) have no uncertainty, hence no fee
	if (price <= 0 || price >= 1) return 0;

	// 0.072 is the static category rate for Crypto markets
	const fee = shares * 0.072 * price * (1 - price);

	// Polymarket rounds fractions below 0.00001 down to zero
	return fee < 0.00001 ? 0 : fee;
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
	timezone: string = 'Asia/Jerusalem',
): number {
	const startOfToday = DateTime.now().setZone(timezone).startOf('day');
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
/**
 * Check if a given time falls within an exclusion window (HH:mm format).
 */
export function isTimeExcluded(
	now: DateTime,
	window: { start: string; end: string },
): boolean {
	const [startH, startM] = window.start.split(':').map(Number);
	const [endH, endM] = window.end.split(':').map(Number);

	const currentTimeInMinutes = now.hour * 60 + now.minute;
	const startTotalMinutes = startH * 60 + startM;
	let endTotalMinutes = endH * 60 + endM;

	// Handle midnight wrap-around (e.g., 23:00 to 01:00)
	if (endTotalMinutes <= startTotalMinutes) {
		// Window crosses midnight
		return (
			currentTimeInMinutes >= startTotalMinutes ||
			currentTimeInMinutes < endTotalMinutes
		);
	}

	return (
		currentTimeInMinutes >= startTotalMinutes &&
		currentTimeInMinutes < endTotalMinutes
	);
}
