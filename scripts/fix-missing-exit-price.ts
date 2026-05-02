/**
 * Repair script: Fix trades in pmbot:history that are missing exitPrice.
 * If exitPrice is 0 or missing, we reconstruct it based on status/won/lost.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', 'copy-bot', '.env') });

import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const PREFIX = 'pmbot:';

async function main() {
	const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 3 });
	console.log('Connected to Redis\n');

	const historyKey = `${PREFIX}history`;
	const historyLen = await redis.llen(historyKey);
	console.log(`History list length: ${historyLen}`);

	let fixedCount = 0;
	let processedCount = 0;

	for (let i = 0; i < historyLen; i++) {
		const raw = await redis.lindex(historyKey, i);
		if (!raw) continue;

		try {
			const trade = JSON.parse(raw);
			processedCount++;

			let needsFix = false;

			// Check if exitPrice is missing, null, or 0 when it shouldn't be
			// Note: exitPrice can be 0 if the trade was lost on resolution (lost = 0.0)
			// But it shouldn't be undefined.
			if (trade.exitPrice === undefined || trade.exitPrice === null) {
				needsFix = true;
			}

			if (needsFix) {
				console.log(
					`\nFound trade with missing exit data: ${trade.id} (${trade.title})`,
				);
				console.log(
					`Current Status: ${trade.status}, PnL: ${trade.pnl}`,
				);

				// Best effort reconstruction
				if (
					trade.status === 'won' ||
					trade.status === 'won_resolution'
				) {
					trade.exitPrice = 1.0;
				} else if (
					trade.status === 'lost' ||
					trade.status === 'lost_resolution'
				) {
					trade.exitPrice = 0.0;
				} else if (trade.exitPrice === undefined) {
					// For closed_tp/closed_sl/closed_sell, if we only have PnL:
					// PnL = (exitPrice * size) - cost - fee
					// exitPrice = (PnL + cost + fee) / size
					if (trade.size > 0) {
						trade.exitPrice =
							(trade.pnl + trade.cost + trade.fee) / trade.size;
						console.log(
							`Inferred exitPrice from PnL: ${trade.exitPrice}`,
						);
					}
				}

				// Recalculate pctChange if missing
				if (trade.pctChange === undefined && trade.entryPrice > 0) {
					trade.pctChange =
						(trade.exitPrice - trade.entryPrice) / trade.entryPrice;
				}

				// Update the item in the list
				await redis.lset(historyKey, i, JSON.stringify(trade));
				console.log(`✅ Fixed trade ${trade.id}`);
				fixedCount++;
			}
		} catch (e) {
			console.error(`Failed to process trade at index ${i}:`, e);
		}
	}

	console.log(`\nTotal trades processed: ${processedCount}`);
	console.log(`Total trades fixed: ${fixedCount}`);

	await redis.quit();
}

main().catch((err) => {
	console.error('Error:', err);
	process.exit(1);
});
