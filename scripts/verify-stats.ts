/**
 * Verify and fix BotStats (totalFees, totalPnl) and balance from trade data.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', 'btc5-bot', '.env') });

import Redis from 'ioredis';

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

	// Get initial balance from strategy config
	const scRaw = await redis.get(`${PREFIX}strategy_config`);
	const sc = scRaw ? JSON.parse(scRaw) : {};
	const initialBalance = sc.botAllowance ?? 100;
	console.log(`Initial balance (botAllowance): $${initialBalance}`);

	let sumFees = 0;
	let sumPnl = 0;
	let activeCostTotal = 0;
	let activeFeeTotal = 0;
	let computedWins = 0;
	let computedLosses = 0;
	let computedTotalTrades = 0;

	// Active trades
	const activeIds = await redis.smembers(`${PREFIX}active_trades`);
	for (const id of activeIds) {
		const raw = await redis.get(`${PREFIX}trade:${id}`);
		if (!raw) continue;
		const t = JSON.parse(raw);
		// Fix fee if missing
		if (t.fee == null) {
			t.fee = calculateFee(t.size, t.entryPrice);
			await redis.set(`${PREFIX}trade:${id}`, JSON.stringify(t));
			console.log(`  Fixed active ${id}: fee=${t.fee}`);
		}
		sumFees += t.fee;
		activeCostTotal += t.cost;
		activeFeeTotal += t.fee;
	}

	// History trades
	const historyKey = `${PREFIX}history`;
	const historyLen = await redis.llen(historyKey);
	for (let i = 0; i < historyLen; i++) {
		const raw = await redis.lindex(historyKey, i);
		if (!raw) continue;
		const t = JSON.parse(raw);
		let changed = false;

		// Fix fee if missing
		if (t.fee == null) {
			const buyFee = calculateFee(t.size, t.entryPrice);
			let sellFee = 0;
			if (
				t.exitPrice != null &&
				t.exitPrice > 0 &&
				t.exitPrice < 1 &&
				(t.status === 'closed_tp' ||
					t.status === 'closed_sl' ||
					t.status === 'closed_sell')
			) {
				sellFee = calculateFee(t.size, t.exitPrice);
			}
			t.fee = buyFee + sellFee;
			changed = true;
		}

		// Fix pnl if missing
		if (t.pnl == null && t.exitPrice != null) {
			t.pnl = t.exitPrice * t.size - t.cost - t.fee;
			changed = true;
		}

		if (changed) {
			await redis.lset(historyKey, i, JSON.stringify(t));
			console.log(
				`  Fixed [${i}] ${t.id}: fee=${t.fee.toFixed(4)} pnl=${t.pnl?.toFixed(4)}`,
			);
		}

		sumFees += t.fee ?? 0;
		sumPnl += t.pnl ?? 0;
		computedTotalTrades += 1;
		if ((t.pnl ?? 0) >= 0) {
			computedWins += 1;
		} else {
			computedLosses += 1;
		}
	}

	// Expected balance:
	// - Buy deducts (cost + buyFee) from balance
	// - Sell adds (revenue - sellFee) to balance
	// - Resolve adds revenue (no sell fee)
	// Since pnl = revenue - cost - totalFee, for closed trades the net effect is pnl + cost + fee - cost - fee...
	// Simpler: balance = initialBalance + totalPnl(closed) - activeCost - activeFee
	const expectedBalance =
		initialBalance + sumPnl - activeCostTotal - activeFeeTotal;

	// Current balance in Redis
	const balanceKey = `${PREFIX}${MODE}:balance`;
	const currentBalanceRaw = await redis.get(balanceKey);
	const currentBalance = currentBalanceRaw
		? parseFloat(currentBalanceRaw)
		: NaN;

	// Stats
	const statsKey = `${PREFIX}${MODE}:stats`;
	const statsRaw = await redis.get(statsKey);
	const stats = statsRaw ? JSON.parse(statsRaw) : {};

	console.log(
		`\nActive trades: ${activeIds.length} (cost: $${activeCostTotal.toFixed(2)}, fee: $${activeFeeTotal.toFixed(4)})`,
	);
	console.log(`History trades: ${historyLen}`);
	console.log();
	console.log('--- Computed from trades ---');
	console.log(`  Sum of fees:      $${sumFees.toFixed(4)}`);
	console.log(`  Sum of pnl:       $${sumPnl.toFixed(4)}`);
	console.log(`  Expected balance: $${expectedBalance.toFixed(4)}`);
	console.log(`  Wins:             ${computedWins}`);
	console.log(`  Losses:           ${computedLosses}`);
	console.log(`  Total trades:     ${computedTotalTrades}`);
	console.log();
	console.log('--- Current in Redis ---');
	console.log(`  totalFees:   ${stats.totalFees}`);
	console.log(`  totalPnl:    ${stats.totalPnl}`);
	console.log(`  balance:     ${currentBalance}`);
	console.log(`  wins:        ${stats.wins}`);
	console.log(`  losses:      ${stats.losses}`);
	console.log(`  totalTrades: ${stats.totalTrades}`);
	console.log();

	const feesMatch = Math.abs((stats.totalFees ?? 0) - sumFees) < 0.001;
	const pnlMatch = Math.abs((stats.totalPnl ?? 0) - sumPnl) < 0.001;
	const balMatch =
		!isNaN(currentBalance) &&
		Math.abs(currentBalance - expectedBalance) < 0.01;
	const winsMatch = (stats.wins ?? 0) === computedWins;
	const lossesMatch = (stats.losses ?? 0) === computedLosses;
	const tradesMatch = (stats.totalTrades ?? 0) === computedTotalTrades;
	console.log(`Fees match:    ${feesMatch ? '✅' : '❌'}`);
	console.log(`PnL match:     ${pnlMatch ? '✅' : '❌'}`);
	console.log(`Balance match: ${balMatch ? '✅' : '❌'}`);
	console.log(`Wins match:    ${winsMatch ? '✅' : '❌'}`);
	console.log(`Losses match:  ${lossesMatch ? '✅' : '❌'}`);
	console.log(`Trades match:  ${tradesMatch ? '✅' : '❌'}`);

	// Fix everything
	let needsFix =
		!feesMatch ||
		!pnlMatch ||
		!balMatch ||
		!winsMatch ||
		!lossesMatch ||
		!tradesMatch;
	if (needsFix) {
		console.log('\n🔧 Fixing...');

		stats.totalFees = Math.round(sumFees * 10000) / 10000;
		stats.totalPnl = Math.round(sumPnl * 10000) / 10000;
		stats.wins = computedWins;
		stats.losses = computedLosses;
		stats.totalTrades = computedTotalTrades;
		await redis.set(statsKey, JSON.stringify(stats));
		console.log(
			`  Stats → totalFees=${stats.totalFees}, totalPnl=${stats.totalPnl}, wins=${stats.wins}, losses=${stats.losses}, totalTrades=${stats.totalTrades}`,
		);

		const fixedBalance = Math.round(expectedBalance * 10000) / 10000;
		await redis.set(balanceKey, fixedBalance.toString());
		console.log(`  Balance → $${fixedBalance}`);

		console.log('\n✅ All fixed.');
	} else {
		console.log('\n✅ Everything matches. No fix needed.');
	}

	await redis.quit();
}

main().catch((err) => {
	console.error('Error:', err);
	process.exit(1);
});
