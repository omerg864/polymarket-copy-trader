/**
 * Script to remove trades with an absolute price difference (Entry BTC vs Target BTC) > 20.
 *
 * Logic:
 * 1. Find "opposite" trades.
 * 2. Filter for |Entry BTC - Target BTC| > 20.
 * 3. Delete from:
 *    - pmbot:demo:trade:ID (Key)
 *    - pmbot:demo:active_trades (Set)
 *    - pmbot:demo:history (List)
 *    - pmbot:demo:history_ids (Set)
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Redis from 'ioredis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment from .env.production.local
dotenv.config({
	path: path.resolve(__dirname, '..', 'copy-bot', '.env.production.local'),
});

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const PREFIX = 'pmbot:';
const MODE = process.env.MODE || 'demo';

async function main() {
	const redis = new Redis(REDIS_URL);
	console.log(`Connected to Redis: ${REDIS_URL}`);
	console.log(`Mode: ${MODE}\n`);

	const toRemove: any[] = [];
	const historyToRemove: string[] = [];

	// 1. Scan Active Trades
	const activeIdsKey = `${PREFIX}${MODE}:active_trades`;
	const activeIds = await redis.smembers(activeIdsKey);

	for (const id of activeIds) {
		const tradeKey = `${PREFIX}${MODE}:trade:${id}`;
		const raw = await redis.get(tradeKey);
		if (!raw) continue;
		const trade = JSON.parse(raw);

		if (isExtremeOpposite(trade)) {
			toRemove.push({ id, source: 'active', trade });
		}
	}

	// 2. Scan History Trades
	const historyKey = `${PREFIX}${MODE}:history`;
	const historyRaw = await redis.lrange(historyKey, 0, -1);

	for (const raw of historyRaw) {
		const trade = JSON.parse(raw);
		if (isExtremeOpposite(trade)) {
			toRemove.push({ id: trade.id, source: 'history', trade });
			historyToRemove.push(raw);
		}
	}

	if (toRemove.length === 0) {
		console.log('✅ No trades matching the criteria (> 20 diff) found.');
		await redis.quit();
		return;
	}

	console.log(`🚨 Found ${toRemove.length} trades to remove (diff > 20):\n`);
	console.table(
		toRemove.map((t) => {
			const entryBTC = t.trade.indicators?.currentPrice
				? parseFloat(t.trade.indicators.currentPrice)
				: t.trade.entryPrice;
			const targetBTC = t.trade.indicators?.priceToBeat
				? parseFloat(t.trade.indicators.priceToBeat)
				: t.trade.priceToBeat;
			return {
				ID: t.id,
				Source: t.source,
				'Entry BTC': entryBTC.toFixed(2),
				'Target BTC': targetBTC.toFixed(2),
				Diff: (entryBTC - targetBTC).toFixed(2),
				Status: t.trade.status,
			};
		}),
	);

	console.log('\nStarting removal process...');

	for (const item of toRemove) {
		const { id, source } = item;

		// Remove individual trade key
		const tradeKey = `${PREFIX}${MODE}:trade:${id}`;
		await redis.del(tradeKey);

		// Remove from active_trades set
		if (source === 'active') {
			await redis.srem(`${PREFIX}${MODE}:active_trades`, id);
		}

		// Remove from history_ids set
		await redis.srem(`${PREFIX}${MODE}:history_ids`, id);

		console.log(`  🗑️ Removed trade ${id} from keys and sets`);
	}

	// Remove from history list (using exact JSON strings)
	for (const raw of historyToRemove) {
		const result = await redis.lrem(historyKey, 0, raw);
		if (result > 0) {
			console.log(`  🗑️ Removed trade from history list`);
		}
	}

	console.log('\n✅ Cleanup complete.');

	await redis.quit();
}

function isExtremeOpposite(trade: any): boolean {
	let entryPrice = trade.indicators?.currentPrice
		? parseFloat(trade.indicators.currentPrice)
		: trade.entryPrice;
	let targetPrice = trade.indicators?.priceToBeat
		? parseFloat(trade.indicators.priceToBeat)
		: trade.priceToBeat;

	if (
		entryPrice == null ||
		targetPrice == null ||
		isNaN(entryPrice) ||
		isNaN(targetPrice) ||
		targetPrice === 0 ||
		entryPrice < 1000
	) {
		return false;
	}

	const diff = entryPrice - targetPrice;
	const absDiff = Math.abs(diff);

	// Condition: Opposite AND abs diff > 20
	const isOpposite =
		(trade.direction === 'UP' && diff < 0) ||
		(trade.direction === 'DOWN' && diff > 0);

	return isOpposite && absDiff > 20;
}

main().catch((err) => {
	console.error('Error:', err);
	process.exit(1);
});
