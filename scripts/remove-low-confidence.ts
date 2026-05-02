/**
 * Remove all trades with confidence strictly below a given threshold.
 *
 * Usage:
 *   npx tsx scripts/remove-low-confidence.ts <minConfidence>
 *
 * Example – remove every trade whose confidence < 70 (percent):
 *   npx tsx scripts/remove-low-confidence.ts 70
 *
 * The threshold is interpreted as a percentage (0-100).
 * Trades whose confidence is exactly equal to the threshold are KEPT.
 * Trades with no confidence value (undefined / null) are also removed.
 *
 * Pass --dry-run to preview which trades would be deleted without actually
 * deleting them:
 *   npx tsx scripts/remove-low-confidence.ts 70 --dry-run
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Redis from 'ioredis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
	path: path.resolve(__dirname, '..', 'copy-bot', '.env.production.local'),
});

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const PREFIX = 'pmbot:';
const MODE = process.env.MODE || 'production';

// ── CLI args ────────────────────────────────────────────────────────────
const args = process.argv.slice(2).filter((a) => a !== '--dry-run');
const dryRun = process.argv.includes('--dry-run');

const minConfidencePct = parseFloat(args[0]);
if (isNaN(minConfidencePct) || minConfidencePct < 0 || minConfidencePct > 100) {
	console.error(
		'Usage: npx tsx scripts/remove-low-confidence.ts <minConfidence> [--dry-run]\n' +
			'       minConfidence must be a number between 0 and 100.',
	);
	process.exit(1);
}

const minConfidence = minConfidencePct / 100; // convert to 0-1 scale

// ── Helpers ─────────────────────────────────────────────────────────────
function shouldRemove(trade: any): boolean {
	const conf = trade.confidence;
	// Remove if confidence is missing or strictly less than the threshold
	return conf == null || conf < minConfidence;
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
	const redis = new Redis(REDIS_URL);
	console.log(`Connected to Redis (MODE: ${MODE})`);
	console.log(`Minimum confidence: ${minConfidencePct}%`);
	console.log(
		`Dry run: ${dryRun ? 'YES – no changes will be made' : 'NO – will delete trades'}\n`,
	);

	const toRemove: { id: string; source: string; trade: any }[] = [];
	const historyToRemove: string[] = [];

	// 1. Scan active trades
	const activeIdsKey = `${PREFIX}${MODE}:active_trades`;
	const activeIds = await redis.smembers(activeIdsKey);

	for (const id of activeIds) {
		const tradeKey = `${PREFIX}${MODE}:trade:${id}`;
		const raw = await redis.get(tradeKey);
		if (!raw) continue;
		const trade = JSON.parse(raw);

		if (shouldRemove(trade)) {
			toRemove.push({ id, source: 'active', trade });
		}
	}

	// 2. Scan history
	const historyKey = `${PREFIX}${MODE}:history`;
	const historyRaw = await redis.lrange(historyKey, 0, -1);

	for (const raw of historyRaw) {
		const trade = JSON.parse(raw);
		if (shouldRemove(trade)) {
			toRemove.push({ id: trade.id, source: 'history', trade });
			historyToRemove.push(raw);
		}
	}

	if (toRemove.length === 0) {
		console.log(
			`✅ No trades found with confidence below ${minConfidencePct}%.`,
		);
		await redis.quit();
		return;
	}

	// Print summary table
	console.log(
		`🚨 Found ${toRemove.length} trade(s) with confidence < ${minConfidencePct}%:\n`,
	);
	console.table(
		toRemove.map((t) => ({
			ID: t.id.slice(0, 8) + '…',
			Source: t.source,
			Direction: t.trade.direction,
			Confidence:
				t.trade.confidence != null
					? `${(t.trade.confidence * 100).toFixed(1)}%`
					: 'N/A',
			PnL: `$${t.trade.pnl?.toFixed(2) ?? '?'}`,
			Status: t.trade.status,
			Slug: t.trade.slug?.slice(0, 30),
		})),
	);

	// Summary stats
	const totalPnl = toRemove.reduce((sum, t) => sum + (t.trade.pnl ?? 0), 0);
	const wins = toRemove.filter((t) =>
		['won', 'closed_tp', 'closed_fct'].includes(t.trade.status),
	).length;
	const losses = toRemove.filter((t) =>
		['lost', 'closed_sl'].includes(t.trade.status),
	).length;
	const winRate =
		wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : 'N/A';

	console.log(`\n📊 Total PnL of matched trades: $${totalPnl.toFixed(2)}`);
	console.log(`   Wins: ${wins} | Losses: ${losses} | Win Rate: ${winRate}%`);

	if (dryRun) {
		console.log('\n🔍 Dry run complete – no trades were deleted.');
		await redis.quit();
		return;
	}

	// ── Actual deletion ─────────────────────────────────────────────────
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

		console.log(`  🗑️  Removed trade ${id}`);
	}

	// Remove from history list (using exact JSON strings)
	for (const raw of historyToRemove) {
		const result = await redis.lrem(historyKey, 0, raw);
		if (result > 0) {
			console.log(`  🗑️  Removed entry from history list`);
		}
	}

	console.log(`\n✅ Removed ${toRemove.length} trade(s). Cleanup complete.`);
	await redis.quit();
}

main().catch((err) => {
	console.error('Error:', err);
	process.exit(1);
});
