import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { DateTime } from 'luxon';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Global BTC Price Formatter
 * Uses minimum 2, maximum 2 fraction digits as requested.
 */
export function formatBtcPrice(price: number | string | undefined | null) {
	if (price === undefined || price === null || price === 'N/A') return '—';
	const num = typeof price === 'string' ? parseFloat(price) : price;
	if (isNaN(num)) return '—';
	return num.toLocaleString(undefined, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
}

/**
 * Global Date Formatter
 * Format: MMM d (e.g., Apr 1)
 */
export function formatGlobalDate(
	iso: string | number | undefined | null,
	timezone: string,
) {
	if (!iso) return '—';
	const dt =
		typeof iso === 'number'
			? DateTime.fromMillis(iso)
			: DateTime.fromISO(iso);
	return dt.setZone(timezone).toFormat('MMM d');
}

/**
 * Global Time Formatter
 * Format: HH:mm:ss (e.g., 13:45:00)
 */
export function formatGlobalTime(
	iso: string | number | undefined | null,
	timezone: string,
) {
	if (!iso) return '—';
	const dt =
		typeof iso === 'number'
			? DateTime.fromMillis(iso)
			: DateTime.fromISO(iso);
	return dt.setZone(timezone).toFormat('HH:mm:ss');
}

/**
 * Global DateTime Formatter
 * Format: MMM d, HH:mm:ss
 */
export function formatGlobalDateTime(
	iso: string | number | undefined | null,
	timezone: string,
) {
	if (!iso) return '—';
	const dt =
		typeof iso === 'number'
			? DateTime.fromMillis(iso)
			: DateTime.fromISO(iso);
	return dt.setZone(timezone).toFormat('MMM d, HH:mm:ss');
}
