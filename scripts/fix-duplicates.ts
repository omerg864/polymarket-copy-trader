/**
 * Fix duplicate trades in the Redis history list.
 * Group by tradeId and keep the one with the lower endTime.
 * Also recalculates stats and balance.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', 'copy-bot', '.env') });

import Redis from 'ioredis';
import { Trade } from '../shared/src/types';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const PREFIX = 'pmbot:';
const MODE = process.env.MODE || 'demo';
const FEE_RATE = 0.0175;

function calculateFee(shares: number, price: number): number {
	const raw = shares * price * FEE_RATE * (price * (1 - price));
	return Math.round(raw * 10000) / 10000;
}

async function main() {
	const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 3 });
	console.log('Connected to Redis\n');

	const historyKey = `${PREFIX}history`;
	const historyLen = await redis.llen(historyKey);
	if (historyLen === 0) {
		console.log('No history found. Exiting.');
		await redis.quit();
		return;
	}

	console.log(`Scanning ${historyLen} history items for duplicates...`);

	const allHistory: any[] = [];
	for (let i = 0; i < historyLen; i++) {
		const raw = await redis.lindex(historyKey, i);
		if (raw) allHistory.push(JSON.parse(raw));
	}

	// Group by ID
	const groups: Record<string, any[]> = {};
	for (const trade of allHistory) {
		if (!groups[trade.id]) groups[trade.id] = [];
		groups[trade.id].push(trade);
	}

	const cleanedHistory: any[] = [];
	let removedCount = 0;

	for (const id in groups) {
		const group = groups[id];
		if (group.length > 1) {
			console.log(`Found ${group.length} entries for trade ${id}`);
			// Sort by endTime (lower first)
			group.sort((a, b) => {
				const timeA = new Date(a.endTime || 0).getTime();
				const timeB = new Date(b.endTime || 0).getTime();
				return timeA - timeB;
			});
			cleanedHistory.push(group[0]);
			removedCount += group.length - 1;
		} else {
			cleanedHistory.push(group[0]);
		}
	}

	if (removedCount > 0) {
		console.log(`\nFound ${removedCount} duplicates. Cleaning up...`);

		// Sort history by endTime ascending generally
		cleanedHistory.sort((a, b) => {
			const timeA = new Date(a.endTime || 0).getTime();
			const timeB = new Date(b.endTime || 0).getTime();
			return timeA - timeB;
		});

		//原子性 update is hard with LIST, so we'll just overwrite
		await redis.del(historyKey);
		for (const trade of cleanedHistory) {
			await redis.rpush(historyKey, JSON.stringify(trade));
		}

		console.log(
			'✅ History cleaned. Now recalculating stats and balance...',
		);

		// Recalculate stats & balance logic (similar to verify-stats)
		const scRaw = await redis.get(`${PREFIX}strategy_config`);
		const sc = scRaw ? JSON.parse(scRaw) : {};
		const initialBalance = sc.botAllowance ?? 100;

		let sumFees = 0;
		let sumPnl = 0;
		let wins = 0;
		let losses = 0;

		for (const t of cleanedHistory) {
			sumFees += t.fee ?? 0;
			sumPnl += t.pnl ?? 0;
			if ((t.pnl ?? 0) >= 0) wins++;
			else losses++;
		}

		// Active trades cost/fee
		let activeCostTotal = 0;
		let activeFeeTotal = 0;
		const activeIds = await redis.smembers(`${PREFIX}active_trades`);
		for (const id of activeIds) {
			const raw = await redis.get(`${PREFIX}trade:${id}`);
			if (raw) {
				const t = JSON.parse(raw);
				activeCostTotal += t.cost || 0;
				activeFeeTotal += t.fee || 0;
			}
		}

		const expectedBalance =
			initialBalance + sumPnl - activeCostTotal - activeFeeTotal;

		// Update stats
		const statsKey = `${PREFIX}${MODE}:stats`;
		const stats = {
			totalFees: Math.round(sumFees * 10000) / 10000,
			totalPnl: Math.round(sumPnl * 10000) / 10000,
			wins,
			losses,
			totalTrades: cleanedHistory.length,
			lastUpdated: new Date().toISOString(),
		};
		await redis.set(statsKey, JSON.stringify(stats));

		const balanceKey = `${PREFIX}${MODE}:balance`;
		await redis.set(balanceKey, expectedBalance.toFixed(4));

		console.log(`\nNew Stats:`);
		console.log(`  PnL:      $${stats.totalPnl}`);
		console.log(`  Fees:     $${stats.totalFees}`);
		console.log(`  Wins/Loss: ${wins}/${losses}`);
		console.log(`  Balance:  $${expectedBalance.toFixed(4)}`);
		console.log('\n✅ All fixed.');
	} else {
		console.log('\n✅ No duplicates found in history.');
	}

	await redis.quit();
}

main().catch((err) => {
	console.error('Error:', err);
	process.exit(1);
});
