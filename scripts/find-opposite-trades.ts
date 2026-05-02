/**
 * Script to find trades where the entry BTC price was "opposite" of the target price.
 *
 * Logic:
 * - Direction UP trades should enter ABOVE the priceToBeat.
 * - Direction DOWN trades should enter BELOW the priceToBeat.
 * - "Opposite" means:
 *    - Direction UP and entryBtcPrice < priceToBeat
 *    - Direction DOWN and entryBtcPrice > priceToBeat
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

	const oppositeTrades: any[] = [];

	// 1. Check Active Trades
	// Key: pmbot:demo:active_trades (Set of IDs)
	const activeIdsKey = `${PREFIX}${MODE}:active_trades`;
	const activeIds = await redis.smembers(activeIdsKey);

	console.log(`Checking ${activeIds.length} active trades...`);
	for (const id of activeIds) {
		// Key: pmbot:demo:trade:ID
		const tradeKey = `${PREFIX}${MODE}:trade:${id}`;
		const raw = await redis.get(tradeKey);
		if (!raw) continue;
		const trade = JSON.parse(raw);

		if (isOpposite(trade)) {
			oppositeTrades.push({ source: 'active', ...trade });
		}
	}

	// 2. Check History Trades
	// Key: pmbot:demo:history (List of JSON strings)
	const historyKey = `${PREFIX}${MODE}:history`;
	const historyLen = await redis.llen(historyKey);
	console.log(`Checking ${historyLen} history trades...`);

	const historyRaw = await redis.lrange(historyKey, 0, -1);
	for (const raw of historyRaw) {
		const trade = JSON.parse(raw);
		if (isOpposite(trade)) {
			oppositeTrades.push({ source: 'history', ...trade });
		}
	}

	if (oppositeTrades.length === 0) {
		console.log('\n✅ No "opposite" trades found.');
	} else {
		console.log(`\n❌ Found ${oppositeTrades.length} "opposite" trades:\n`);

		let totalPnL = 0;
		const tableData = oppositeTrades.map((t) => {
			const entryBTC = t.indicators?.currentPrice
				? parseFloat(t.indicators.currentPrice)
				: t.entryPrice;
			const targetBTC = t.indicators?.priceToBeat
				? parseFloat(t.indicators.priceToBeat)
				: t.priceToBeat;
			const diff = entryBTC - targetBTC;
			const dir = t.direction;
			const pnl = t.pnl || 0;
			totalPnL += pnl;

			return {
				ID: t.id,
				Dir: dir,
				'Entry BTC': entryBTC.toFixed(2),
				'Target BTC': targetBTC.toFixed(2),
				Diff: diff.toFixed(2),
				'Dist %': t.indicators?.distFromRef || 'N/A',
				PnL: pnl != null ? `$${pnl.toFixed(2)}` : 'N/A',
				Status: t.status,
				Entered: t.enteredAt
					? new Date(t.enteredAt).toLocaleString()
					: 'N/A',
			};
		});

		console.table(tableData);
		console.log(
			`\n💰 Total PnL for these trades: ${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}`,
		);
	}

	await redis.quit();
}

/**
 * Filter Condition:
 * Direction UP and entered at price < priceToBeat (should be >=)
 * Direction DOWN and entered at price > priceToBeat (should be <=)
 */
function isOpposite(trade: any): boolean {
	// Prioritize indicator data as it always contains the BTC price at entry
	let entryPrice = trade.indicators?.currentPrice
		? parseFloat(trade.indicators.currentPrice)
		: trade.entryPrice;
	let targetPrice = trade.indicators?.priceToBeat
		? parseFloat(trade.indicators.priceToBeat)
		: trade.priceToBeat;

	// Basic validation
	if (
		entryPrice == null ||
		targetPrice == null ||
		isNaN(entryPrice) ||
		isNaN(targetPrice) ||
		targetPrice === 0
	) {
		return false;
	}

	// If entryPrice is too small, it's likely a share price (e.g. 0.85) instead of BTC price (e.g. 70000)
	// We skip these to avoid false positives if indicators are missing
	if (entryPrice < 1000) {
		return false;
	}

	// UP trade: Expecting price to go ABOVE target.
	if (trade.direction === 'UP' && entryPrice < targetPrice) {
		return true;
	}

	// DOWN trade: Expecting price to go BELOW target.
	if (trade.direction === 'DOWN' && entryPrice > targetPrice) {
		return true;
	}

	return false;
}

main().catch((err) => {
	console.error('Error:', err);
	process.exit(1);
});
