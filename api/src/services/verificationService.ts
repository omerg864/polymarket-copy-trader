import { DateTime } from 'luxon';
import type { TradeType, VerificationResult } from '../../../shared/src/types';
import { TradeModel } from '../models/Trade';
import {
	REDIS_KEYS,
	getTradeKey,
	redis,
	setBotStats,
	setBotBalance,
	setDailyStats,
} from './redis';
import { getStrategyConfig } from './strategyConfig';
import { calculateFee } from '../../../shared/src/utils';
import { BankingTransactionModel } from '../models/BankingTransaction';

export class VerificationService {
	async verifyAndFixStats(
		mode: TradeType,
		fix: boolean,
	): Promise<VerificationResult> {
		const logs: string[] = [];

		logs.push(`Starting verification for ${mode} mode...`);

		// Get initial balance from strategy config
		const sc = await getStrategyConfig(mode);
		const initialBalance = sc.botAllowance ?? 100;
		logs.push(`Initial balance (botAllowance): $${initialBalance}`);

		let sumFees = 0;
		let sumPnl = 0;
		let activeCostTotal = 0;
		let activeFeeTotal = 0;
		let awaitingResolveCostTotal = 0;
		let awaitingResolveFeeTotal = 0;
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

		// fetch both active and awaiting resolve trades
		const [activeIds, awaitingResolveIds] = await Promise.all([
			redis.smembers(REDIS_KEYS.ACTIVE_TRADES(mode)),
			redis.smembers(REDIS_KEYS.AWAITING_RESOLVE_TRADES(mode)),
		]);

		// Process Active Trades
		for (const id of activeIds) {
			const raw = await redis.get(getTradeKey(mode, id));
			if (!raw) continue;
			const t = JSON.parse(raw);
			// Fix fee if missing
			if (t.fee == null) {
				t.fee = calculateFee(t.size, t.entryPrice);
				if (fix) {
					await redis.set(getTradeKey(mode, id), JSON.stringify(t));
					logs.push(`  Fixed active ${id}: fee=${t.fee}`);
				} else {
					logs.push(`  Discrepancy: active ${id} missing fee`);
				}
			}
			sumFees += t.fee;
			activeCostTotal += t.cost;
			activeFeeTotal += t.fee;
		}

		// Process Awaiting Resolve Trades
		for (const id of awaitingResolveIds) {
			const raw = await redis.get(getTradeKey(mode, id));
			if (!raw) continue;
			const t = JSON.parse(raw);
			// Fix fee if missing
			if (t.fee == null) {
				t.fee = calculateFee(t.size, t.entryPrice);
				if (fix) {
					await redis.set(getTradeKey(mode, id), JSON.stringify(t));
					logs.push(`  Fixed resolve ${id}: fee=${t.fee}`);
				} else {
					logs.push(`  Discrepancy: resolve ${id} missing fee`);
				}
			}
			sumFees += t.fee;
			awaitingResolveCostTotal += t.cost;
			awaitingResolveFeeTotal += t.fee;
		}

		// History trades from MongoDB
		const historyTrades = await TradeModel.find({ type: mode });
		const historyLen = historyTrades.length;

		for (const doc of historyTrades) {
			const t = doc.toObject() as any;
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

			if (changed && fix) {
				await TradeModel.updateOne(
					{ _id: doc._id },
					{ $set: { fee: t.fee, pnl: t.pnl } },
				);
				logs.push(
					`  Fixed ${t.id} in MongoDB: fee=${t.fee.toFixed(4)} pnl=${t.pnl?.toFixed(4)}`,
				);
			} else if (changed) {
				logs.push(`  Discrepancy: ${t.id} missing fee or pnl`);
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

			// Calculate daily stats
			if (t.enteredAt) {
				const dateStr =
					DateTime.fromISO(t.enteredAt)
						.setZone(timezone)
						.toISODate() || '';
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

		// Banking Transactions from MongoDB
		const bankingTransactions = await BankingTransactionModel.find({
			mode,
		});
		let sumBanking = 0;
		for (const bt of bankingTransactions) {
			if (bt.type === 'deposit') {
				sumBanking += bt.amount;
			} else {
				sumBanking -= bt.amount;
			}
		}
		logs.push(`Banking transactions total: $${sumBanking.toFixed(2)}`);

		// Expected balance
		const expectedBalance =
			initialBalance +
			sumBanking +
			sumPnl -
			(activeCostTotal + awaitingResolveCostTotal) -
			(activeFeeTotal + awaitingResolveFeeTotal);

		// Current stats in Redis
		const currentBalance = await redis
			.get(REDIS_KEYS.BALANCE(mode))
			.then((v) => (v ? parseFloat(v) : NaN));
		const stats = await redis
			.get(REDIS_KEYS.STATS(mode))
			.then((v) => (v ? JSON.parse(v) : {}));

		const dailyPnlKey = REDIS_KEYS.DAILY_PNL(mode, todayStr);
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

		// Check matches
		const matches = {
			fees: Math.abs((stats.totalFees ?? 0) - sumFees) < 0.001,
			pnl: Math.abs((stats.totalPnl ?? 0) - sumPnl) < 0.001,
			balance:
				!isNaN(currentBalance) &&
				Math.abs(currentBalance - expectedBalance) < 0.01,
			wins: (stats.wins ?? 0) === computedWins,
			losses: (stats.losses ?? 0) === computedLosses,
			totalTrades: (stats.totalTrades ?? 0) === computedTotalTrades,
			todayPnl: Math.abs(todayPnL - sumTodayPnl) < 0.001,
			todayWins: todayWins === sumTodayWins,
			todayLosses: todayLosses === sumTodayLosses,
		};

		const needsFix =
			Object.values(matches).some((m) => !m) || dailyType !== 'hash';

		logs.push(
			`\nActive trades: ${activeIds.length} (cost: $${activeCostTotal.toFixed(2)}, fee: $${activeFeeTotal.toFixed(4)})`,
		);
		logs.push(
			`Awaiting resolve: ${awaitingResolveIds.length} (cost: $${awaitingResolveCostTotal.toFixed(2)}, fee: $${awaitingResolveFeeTotal.toFixed(4)})`,
		);
		logs.push(`History trades: ${historyLen}`);
		logs.push(`\nComputed vs Redis:`);
		logs.push(
			`  Fees:     $${sumFees.toFixed(4)} vs ${stats.totalFees} (${matches.fees ? '✅' : '❌'})`,
		);
		logs.push(
			`  PnL:      $${sumPnl.toFixed(4)} vs ${stats.totalPnl} (${matches.pnl ? '✅' : '❌'})`,
		);
		logs.push(
			`  TodayPnL: ${sumTodayPnl.toFixed(4)} vs ${todayPnL} (${matches.todayPnl ? '✅' : '❌'})`,
		);
		logs.push(
			`  Balance:  $${expectedBalance.toFixed(4)} vs ${currentBalance} (${matches.balance ? '✅' : '❌'})`,
		);
		logs.push(
			`  Wins:     ${computedWins} vs ${stats.wins} (${matches.wins ? '✅' : '❌'})`,
		);
		logs.push(
			`  Losses:   ${computedLosses} vs ${stats.losses} (${matches.losses ? '✅' : '❌'})`,
		);
		logs.push(
			`  Total:    ${computedTotalTrades} vs ${stats.totalTrades} (${matches.totalTrades ? '✅' : '❌'})`,
		);

		if (needsFix) {
			if (!fix) {
				logs.push(
					'\n⚠️ Discrepancies found. Run with "Fix" enabled to repair.',
				);
			} else {
				logs.push('\n🔧 Fixing...');

				const fixedStats = {
					totalFees: Math.round(sumFees * 10000) / 10000,
					totalPnl: Math.round(sumPnl * 10000) / 10000,
					wins: computedWins,
					losses: computedLosses,
					totalTrades: computedTotalTrades,
				};
				await setBotStats(mode, fixedStats);

				await setBotBalance(
					mode,
					Math.round(expectedBalance * 10000) / 10000,
				);

				// Fix all days found in history
				for (const [date, dStats] of dailyStatsMap.entries()) {
					await setDailyStats(mode, date, {
						pnl: Math.round(dStats.pnl * 10000) / 10000,
						wins: dStats.wins,
						losses: dStats.losses,
					});
				}

				logs.push('\n✅ All fixed.');
			}
		} else {
			logs.push('\n✅ Everything matches. No fix needed.');
		}

		return {
			success: true,
			fix,
			initialBalance,
			activeTrades: {
				count: activeIds.length,
				cost: activeCostTotal,
				fee: activeFeeTotal,
			},
			awaitingResolveTrades: {
				count: awaitingResolveIds.length,
				cost: awaitingResolveCostTotal,
				fee: awaitingResolveFeeTotal,
			},
			historyTrades: {
				count: historyLen,
			},
			computed: {
				sumFees,
				sumPnl,
				expectedBalance,
				wins: computedWins,
				losses: computedLosses,
				totalTrades: computedTotalTrades,
				todayPnl: sumTodayPnl,
				todayWins: sumTodayWins,
				todayLosses: sumTodayLosses,
				sumBanking,
			},
			redis: {
				totalFees: stats.totalFees,
				totalPnl: stats.totalPnl,
				balance: currentBalance,
				wins: stats.wins,
				losses: stats.losses,
				totalTrades: stats.totalTrades,
				todayPnl: todayPnL,
				todayWins,
				todayLosses,
				dailyType,
			},
			matches,
			needsFix,
			logs,
		};
	}
}

export const verificationService = new VerificationService();
