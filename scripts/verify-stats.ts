/**
 * Verify and fix BotStats (totalFees, totalPnl) and balance from trade data.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
	path: path.resolve(__dirname, '..', 'copy-bot', '.env.production.local'),
});

import Redis from 'ioredis';
import { DateTime } from 'luxon';
import mongoose, { Schema } from 'mongoose';
import { TradeType } from '../shared/src/types';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const MONGO_URI =
	process.env.MONGO_URI || 'mongodb://localhost:27017/polymarket-bot';
const PREFIX = 'pmbot:';
const MODE = process.env.MODE === 'live' ? TradeType.LIVE : TradeType.DEMO;
const FEE_RATE = 0.0175;

function calculateFee(shares: number, price: number): number {
	const raw = shares * price * FEE_RATE * (price * (1 - price));
	return Math.round(raw * 10000) / 10000;
}

const tradeSchema = new Schema(
	{
		tradeId: { type: String, required: true, unique: true, index: true },
		type: {
			type: String,
			enum: Object.values(TradeType),
			required: true,
			index: true,
		},
		direction: { type: String, enum: ['UP', 'DOWN'], required: true },
		tokenId: { type: String, required: true },
		conditionId: { type: String, required: true },
		slug: { type: String },
		eventTicker: { type: String },
		title: { type: String },
		side: { type: String },
		entryPrice: { type: Number, required: true },
		currentPrice: { type: Number },
		exitPrice: { type: Number },
		exitBtcPrice: { type: Number },
		size: { type: Number, required: true },
		cost: { type: Number, required: true },
		fee: { type: Number, required: true },
		status: { type: String, required: true },
		startTime: { type: String, required: true },
		endTime: { type: String, required: true },
		enteredAt: { type: String, required: true },
		closedAt: { type: String, index: true },
		priceToBeat: { type: Number, required: true },
		pnl: { type: Number, required: true },
		pctChange: { type: Number },
		confidence: { type: Number },
		indicators: { type: Schema.Types.Mixed },
		actualOutcome: { type: String, enum: ['UP', 'DOWN', 'UNKNOWN'] },
	},
	{ timestamps: true },
);

const TradeModel = (mongoose.models.Trade ||
	mongoose.model('Trade', tradeSchema)) as mongoose.Model<any>;

async function main() {
	const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 3 });
	console.log('Connected to Redis');

	await mongoose.connect(MONGO_URI);
	console.log('Connected to MongoDB\n');

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
	let sumTodayPnl = 0;
	let sumTodayWins = 0;
	let sumTodayLosses = 0;
	const dailyStatsMap = new Map<
		string,
		{ pnl: number; wins: number; losses: number }
	>();

	const timezone = sc.timezone || 'Asia/Jerusalem';
	const todayStr = DateTime.now().setZone(timezone).toISODate() || '';

	// Active trades
	const activeIds = await redis.smembers(`${PREFIX}${MODE}:active_trades`);
	for (const id of activeIds) {
		const raw = await redis.get(`${PREFIX}${MODE}:trade:${id}`);
		if (!raw) continue;
		const t = JSON.parse(raw);
		// Fix fee if missing
		if (t.fee == null) {
			t.fee = calculateFee(t.size, t.entryPrice);
			await redis.set(`${PREFIX}${MODE}:trade:${id}`, JSON.stringify(t));
			console.log(`  Fixed active ${id}: fee=${t.fee}`);
		}
		sumFees += t.fee;
		activeCostTotal += t.cost;
		activeFeeTotal += t.fee;
	}

	// History trades from MongoDB
	const historyTrades = await TradeModel.find({
		type: MODE,
	});
	const historyLen = historyTrades.length;

	for (const doc of historyTrades) {
		const t = doc.toObject();
		// Map tradeId to id for compatibility with the script's logic
		t.id = t.tradeId;

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
			await TradeModel.updateOne(
				{ _id: doc._id },
				{ $set: { fee: t.fee, pnl: t.pnl } },
			);
			console.log(
				`  Fixed ${t.id} in MongoDB: fee=${t.fee.toFixed(4)} pnl=${t.pnl?.toFixed(4)}`,
			);
		}

		const pnl = t.pnl ?? 0;
		sumFees += t.fee ?? 0;
		sumPnl += pnl;
		computedTotalTrades += 1;
		if (pnl >= 0) {
			computedWins += 1;
		} else {
			computedLosses += 1;
		}

		// Calculate daily stats (PnL, Wins, Losses)
		if (t.enteredAt) {
			const dateStr =
				DateTime.fromISO(t.enteredAt).setZone(timezone).toISODate() ||
				'';
			const dStats = dailyStatsMap.get(dateStr) || {
				pnl: 0,
				wins: 0,
				losses: 0,
			};
			dStats.pnl += pnl;
			if (pnl >= 0) dStats.wins += 1;
			else dStats.losses += 1;
			dailyStatsMap.set(dateStr, dStats);

			if (dateStr === todayStr) {
				sumTodayPnl = dStats.pnl;
				sumTodayWins = dStats.wins;
				sumTodayLosses = dStats.losses;
			}
		}
	}

	// Expected balance:
	// balance = initialBalance + totalPnl(closed) - activeCost - activeFee
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

	const dailyPnlKey = `${PREFIX}${MODE}:daily_pnl:${todayStr}`;
	const dailyType = await redis.type(dailyPnlKey);
	let todayPnL = 0;
	let todayWins = 0;
	let todayLosses = 0;

	if (dailyType === 'hash') {
		const h = await redis.hgetall(dailyPnlKey);
		todayPnL = parseFloat(h.pnl) || 0;
		todayWins = parseInt(h.wins, 10) || 0;
		todayLosses = parseInt(h.losses, 10) || 0;
	} else if (dailyType === 'string') {
		const raw = await redis.get(dailyPnlKey);
		todayPnL = raw ? parseFloat(raw) : 0;
	}

	console.log(
		`  todayPnl:    ${todayPnL} (W: ${todayWins}, L: ${todayLosses}) [Type: ${dailyType}]`,
	);
	console.log();

	const feesMatch = Math.abs((stats.totalFees ?? 0) - sumFees) < 0.001;
	const pnlMatch = Math.abs((stats.totalPnl ?? 0) - sumPnl) < 0.001;
	const balMatch =
		!isNaN(currentBalance) &&
		Math.abs(currentBalance - expectedBalance) < 0.01;
	const winsMatch = (stats.wins ?? 0) === computedWins;
	const lossesMatch = (stats.losses ?? 0) === computedLosses;
	const tradesMatch = (stats.totalTrades ?? 0) === computedTotalTrades;

	const todayPnlMatch = Math.abs(todayPnL - sumTodayPnl) < 0.001;
	const todayWinsMatch = todayWins === sumTodayWins;
	const todayLossesMatch = todayLosses === sumTodayLosses;

	console.log(`Fees match:      ${feesMatch ? '✅' : '❌'}`);
	console.log(`PnL match:       ${pnlMatch ? '✅' : '❌'}`);
	console.log(`Today PnL match: ${todayPnlMatch ? '✅' : '❌'}`);
	console.log(`Today Wins match: ${todayWinsMatch ? '✅' : '❌'}`);
	console.log(`Today Losses match:${todayLossesMatch ? '✅' : '❌'}`);
	console.log(`Balance match:   ${balMatch ? '✅' : '❌'}`);
	console.log(`Wins match:      ${winsMatch ? '✅' : '❌'}`);
	console.log(`Losses match:    ${lossesMatch ? '✅' : '❌'}`);
	console.log(`Trades match:    ${tradesMatch ? '✅' : '❌'}`);

	// Fix everything
	let needsFix =
		!feesMatch ||
		!pnlMatch ||
		!balMatch ||
		!winsMatch ||
		!lossesMatch ||
		!tradesMatch ||
		!todayPnlMatch ||
		!todayWinsMatch ||
		!todayLossesMatch ||
		dailyType !== 'hash';

	const FIX = false;

	if (needsFix) {
		if (!FIX) {
			console.log(
				'\n⚠️ Discrepancies found. Run with FIX=true to repair.',
			);
		} else {
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

			// Fix all days found in history
			for (const [date, dStats] of dailyStatsMap.entries()) {
				const key = `${PREFIX}${MODE}:daily_pnl:${date}`;
				// Clear string if exists
				const t = await redis.type(key);
				if (t === 'string') await redis.del(key);

				await redis.hset(key, {
					pnl: Math.round(dStats.pnl * 10000) / 10000,
					wins: dStats.wins,
					losses: dStats.losses,
				});
				await redis.expire(key, 60 * 60 * 24 * 3);
				console.log(
					`  daily_stats [${date}] → PnL: $${dStats.pnl.toFixed(2)}, W: ${dStats.wins}, L: ${dStats.losses}`,
				);
			}

			console.log('\n✅ All fixed.');
		}
	} else {
		console.log('\n✅ Everything matches. No fix needed.');
	}

	await redis.quit();
	await mongoose.disconnect();
}

main().catch((err) => {
	console.error('Error:', err);
	process.exit(1);
});
