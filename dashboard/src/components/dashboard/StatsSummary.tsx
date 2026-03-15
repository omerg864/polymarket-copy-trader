import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
} from '@/components/ui/card';
import { useConfig, useSummary, useTradeHistory } from '@/hooks/use-api';
import type { Trade } from '@/types';
import { calculateTodayPnl } from '@shared/utils';
import { DateTime } from 'luxon';

export function StatsSummary() {
	const { data: summary } = useSummary();
	const { data: history } = useTradeHistory();
	const { data: config } = useConfig();

	if (!summary) return null;

	const winRate = parseFloat(summary.winRate);
	const totalPnl = summary.totalPnl;
	const totalFees = summary.totalFees ?? 0;
	const initialBalance = summary.initialBalance ?? 100;
	const pnlPercentage =
		initialBalance > 0 ? (totalPnl / initialBalance) * 100 : 0;

	let totalCosts = 0;
	let highestCost = 0;
	let highestWin = 0;
	let highestLoss = 0;
	let todayProfit = 0;
	let todayLoss = 0;
	let todayProfitTrades = 0;
	let todayLossTrades = 0;
	let todayTotalTrades = 0;

	const todayPnl = calculateTodayPnl(history ?? []);
	const startOfToday = DateTime.now().startOf('day');

	if (history) {
		history.forEach((trade: Trade) => {
			totalCosts += trade.cost;
			if (trade.cost > highestCost) highestCost = trade.cost;
			if (trade.pnl > highestWin) highestWin = trade.pnl;
			if (trade.pnl < highestLoss) highestLoss = trade.pnl;
			if (trade.enteredAt) {
				const enteredAt = DateTime.fromISO(trade.enteredAt);
				if (enteredAt >= startOfToday) {
					todayTotalTrades++;
					if (trade.pnl > 0) {
						todayProfit += trade.pnl;
						todayProfitTrades++;
					} else if (trade.pnl < 0) {
						todayLoss += trade.pnl;
						todayLossTrades++;
					}
				}
			}
		});
	}

	const dayPnlGoal = config?.dayPnlGoal ?? 2;
	const goalProgress = dayPnlGoal > 0 ? (todayPnl / dayPnlGoal) * 100 : 0;
	const todayWinRate =
		todayTotalTrades > 0 ? (todayProfitTrades / todayTotalTrades) * 100 : 0;

	return (
		<div className="flex flex-col gap-4 mb-4">
			{/* Row 1: General Stats */}
			<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
				<Card className="bg-zinc-900 border-zinc-800">
					<CardHeader className="pb-2">
						<CardDescription className="text-xs text-zinc-500">
							Balance
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-bold font-mono">
							${summary.balance.toFixed(2)}
						</p>
					</CardContent>
				</Card>

				<Card className="bg-zinc-900 border-zinc-800">
					<CardHeader className="pb-2">
						<CardDescription className="text-xs text-zinc-500">
							Total P&L
						</CardDescription>
					</CardHeader>
					<CardContent>
						<span
							className={`text-2xl font-bold font-mono ${
								totalPnl >= 0
									? 'text-emerald-400'
									: 'text-red-400'
							} text-nowrap`}
						>
							{totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
							<br />
							<span className="text-sm font-normal text-zinc-500">
								({totalPnl >= 0 ? '+' : ''}
								{pnlPercentage.toFixed(2)}%)
							</span>
						</span>
					</CardContent>
				</Card>

				<Card className="bg-zinc-900 border-zinc-800">
					<CardHeader className="pb-2">
						<CardDescription className="text-xs text-zinc-500">
							Win Rate
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p
							className={`text-2xl font-bold font-mono ${
								winRate >= 50
									? 'text-emerald-400'
									: 'text-red-400'
							}`}
						>
							{summary.winRate}%
						</p>
					</CardContent>
				</Card>

				<Card className="bg-zinc-900 border-zinc-800">
					<CardHeader className="pb-2">
						<CardDescription className="text-xs text-zinc-500">
							Total Trades
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-bold font-mono">
							{summary.totalTrades}
						</p>
					</CardContent>
				</Card>

				<Card className="bg-zinc-900 border-zinc-800">
					<CardHeader className="pb-2">
						<CardDescription className="text-xs text-zinc-500">
							Wins / Losses
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-bold font-mono">
							<span className="text-emerald-400">
								{summary.wins}
							</span>
							<span className="text-zinc-600"> / </span>
							<span className="text-red-400">
								{summary.losses}
							</span>
						</p>
					</CardContent>
				</Card>

				<Card className="bg-zinc-900 border-zinc-800">
					<CardHeader className="pb-2">
						<CardDescription className="text-xs text-zinc-500">
							Active Trades
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-bold font-mono text-blue-400">
							{summary.activeTrades}
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Row 2: Advanced Stats */}
			<div className="grid grid-cols-2 md:grid-cols-5 gap-4">
				<Card className="bg-zinc-900 border-zinc-800">
					<CardHeader className="pb-2">
						<CardDescription className="text-xs text-zinc-500">
							Total Fees
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-bold font-mono text-orange-400">
							${totalFees.toFixed(4)}
						</p>
					</CardContent>
				</Card>
				<Card className="bg-zinc-900 border-zinc-800">
					<CardHeader className="pb-2">
						<CardDescription className="text-xs text-zinc-500">
							Total Costs
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-bold font-mono">
							${totalCosts.toFixed(2)}
						</p>
					</CardContent>
				</Card>

				<Card className="bg-zinc-900 border-zinc-800">
					<CardHeader className="pb-2">
						<CardDescription className="text-xs text-zinc-500">
							Highest Cost
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-bold font-mono text-amber-400">
							${highestCost.toFixed(2)}
						</p>
					</CardContent>
				</Card>

				<Card className="bg-zinc-900 border-zinc-800">
					<CardHeader className="pb-2">
						<CardDescription className="text-xs text-zinc-500">
							Highest Win
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-bold font-mono text-emerald-400">
							{highestWin > 0 ? '+' : ''}${highestWin.toFixed(2)}
						</p>
					</CardContent>
				</Card>

				<Card className="bg-zinc-900 border-zinc-800">
					<CardHeader className="pb-2">
						<CardDescription className="text-xs text-zinc-500">
							Highest Loss
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-bold font-mono text-red-400">
							${highestLoss.toFixed(2)}
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Row 3: Today's Performance */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<Card className="bg-zinc-900 border-zinc-800">
					<CardHeader className="pb-2">
						<CardDescription className="text-xs text-zinc-500">
							Today P&L
							<span className="text-zinc-600 ml-1">
								/ ${dayPnlGoal.toFixed(2)} goal
							</span>
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-baseline gap-2">
							<span
								className={`text-2xl font-bold font-mono ${
									todayPnl >= 0
										? 'text-emerald-400'
										: 'text-red-400'
								} text-nowrap`}
							>
								{todayPnl >= 0 ? '+' : ''}${todayPnl.toFixed(2)}
							</span>
							<span className="text-xs text-zinc-500 font-mono">
								({todayTotalTrades})
							</span>
						</div>
						{dayPnlGoal > 0 && (
							<div className="mt-2">
								<div className="w-full bg-zinc-800 rounded-full h-1.5">
									<div
										className={`h-1.5 rounded-full transition-all ${
											todayPnl >= dayPnlGoal
												? 'bg-emerald-400'
												: todayPnl >= 0
													? 'bg-amber-400'
													: 'bg-red-400'
										}`}
										style={{
											width: `${Math.max(0, Math.min(100, goalProgress))}%`,
										}}
									/>
								</div>
								<p className="text-xs text-zinc-600 mt-0.5 font-mono">
									{goalProgress.toFixed(0)}% of goal
								</p>
							</div>
						)}
					</CardContent>
				</Card>

				<Card className="bg-zinc-900 border-zinc-800">
					<CardHeader className="pb-2">
						<CardDescription className="text-xs text-zinc-500">
							Today Win Rate
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-baseline gap-2">
							<span
								className={`text-2xl font-bold font-mono ${
									todayWinRate >= 50
										? 'text-emerald-400'
										: 'text-red-400'
								}`}
							>
								{todayWinRate.toFixed(1)}%
							</span>
							<span className="text-xs text-zinc-500 font-mono">
								({todayProfitTrades}W/{todayLossTrades}L)
							</span>
						</div>
					</CardContent>
				</Card>

				<Card className="bg-zinc-900 border-zinc-800">
					<CardHeader className="pb-2">
						<CardDescription className="text-xs text-zinc-500">
							Today Profit
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-baseline gap-2">
							<span className="text-2xl font-bold font-mono text-emerald-400 text-nowrap">
								+${todayProfit.toFixed(2)}
							</span>
							<span className="text-xs text-zinc-500 font-mono">
								({todayProfitTrades})
							</span>
						</div>
					</CardContent>
				</Card>

				<Card className="bg-zinc-900 border-zinc-800">
					<CardHeader className="pb-2">
						<CardDescription className="text-xs text-zinc-500">
							Today Loss
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-baseline gap-2">
							<span className="text-2xl font-bold font-mono text-red-400 text-nowrap">
								${todayLoss.toFixed(2)}
							</span>
							<span className="text-xs text-zinc-500 font-mono">
								({todayLossTrades})
							</span>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
