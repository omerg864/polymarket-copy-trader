import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import {
	useConfig,
	useFlushRedis,
	useRedisStats,
	useSummary,
	useToggleStop,
	useTradeHistory,
} from '@/hooks/use-api';
import { useMemoizedFn } from 'ahooks';
import { saveAs } from 'file-saver';
import { Database } from 'lucide-react';
import * as XLSX from 'xlsx';
import { HeaderClocks } from './HeaderClocks';

export function Header() {
	const { data: summary, refetch: refetchSummary } = useSummary();
	const { data: history } = useTradeHistory();
	const { data: config } = useConfig();
	const toggleStop = useToggleStop();
	const { data: redisStats, refetch: refetchRedisStats } = useRedisStats();
	const flushRedis = useFlushRedis();

	const handleExport = useMemoizedFn(() => {
		if (!history || !summary || !config) return;

		// 1. Trades Sheet
		const tradesData = history.map((t) => ({
			ID: t.id,
			Status: t.status,
			Direction: t.direction,
			Market: t.title,
			Shares: t.size,
			'Entry Price': t.entryPrice,
			'Exit Price': t.exitPrice || '',
			Cost: t.cost,
			'P&L': t.pnl,
			'Result Money': t.cost + t.pnl,
			'Pct Change': t.pctChange
				? `${(t.pctChange * 100).toFixed(2)}%`
				: '',
			Confidence: t.confidence
				? `${(t.confidence * 100).toFixed(1)}%`
				: '',
			VWAP: t.indicators?.vwap || '',
			StochRSI: t.indicators?.stochRsi || '',
			MicroRSI: t.indicators?.microRsi || '',
			Volatility: t.indicators?.volatility || '',
			'Opened At': t.enteredAt
				? new Date(t.enteredAt).toLocaleString()
				: '',
			'Closed At': t.closedAt
				? new Date(t.closedAt).toLocaleString()
				: '',
		}));
		const wsTrades = XLSX.utils.json_to_sheet(tradesData);

		// 2. Summary Sheet
		const summaryData = [
			{ Metric: 'Balance', Value: summary.balance },
			{ Metric: 'Total P&L', Value: summary.totalPnl },
			{ Metric: 'Total Trades', Value: summary.totalTrades },
			{ Metric: 'Wins', Value: summary.wins },
			{ Metric: 'Losses', Value: summary.losses },
			{ Metric: 'Win Rate', Value: `${summary.winRate}%` },
		];
		const wsSummary = XLSX.utils.json_to_sheet(summaryData);

		// 3. Config Sheet
		const configData = Object.entries(config).map(([key, value]) => ({
			Setting: key,
			Value: value,
		}));
		const wsConfig = XLSX.utils.json_to_sheet(configData);

		// Build Workbook
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, wsTrades, 'Trades');
		XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
		XLSX.utils.book_append_sheet(wb, wsConfig, 'Configuration');

		// Export
		const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
		const data = new Blob([excelBuffer], {
			type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		});
		saveAs(
			data,
			`polymarket-bot-export-${new Date().toISOString().split('T')[0]}.xlsx`,
		);
	});

	return (
		<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
			<div>
				<h1 className="text-xl sm:text-2xl font-bold tracking-tight">
					📊 Polymarket Trading Dashboard
				</h1>
				<p className="text-xs sm:text-sm text-zinc-500 mt-1">
					BTC 5-Minute Up/Down Markets • Auto-refreshes every 5s
				</p>
				<div className="flex flex-wrap items-baseline gap-3">
					<HeaderClocks startTime={summary?.botStartTime} />
					{redisStats && (
						<Badge
							variant="outline"
							className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono text-zinc-400 border-zinc-700/50 bg-zinc-900/50"
						>
							<Database className="h-3 w-3 text-emerald-500/80" />
							{redisStats.memoryUsed} ({redisStats.totalKeys}{' '}
							keys)
						</Badge>
					)}
				</div>
			</div>
			<div className="flex flex-wrap items-center gap-2 sm:gap-4">
				{summary && (
					<Button
						variant="outline"
						className={`h-7 px-3 text-xs font-medium rounded border ${
							summary.isStopping
								? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 hover:text-emerald-300'
								: 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20 hover:text-amber-300'
						} transition-colors`}
						onClick={() =>
							toggleStop.mutate(!summary.isStopping, {
								onSuccess: () => refetchSummary(),
							})
						}
						disabled={toggleStop.isPending}
					>
						{toggleStop.isPending
							? '⌛ Updating...'
							: summary.isStopping
								? '▶️ Resume Trading'
								: '⏸️ Pause New Trades'}
					</Button>
				)}
				<Button
					variant="outline"
					className="h-7 px-3 text-xs font-medium rounded border bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20 hover:text-blue-300 transition-colors"
					onClick={handleExport}
					disabled={!history || !summary || !config}
				>
					📥 Export
				</Button>
				<Dialog>
					<DialogTrigger asChild>
						<Button
							variant="outline"
							className="h-7 px-3 text-xs font-medium rounded border bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20 hover:text-red-300 transition-colors"
							disabled={flushRedis.isPending}
						>
							{flushRedis.isPending
								? '⌛ Flushing...'
								: '🗑️ Flush Redis'}
						</Button>
					</DialogTrigger>
					<DialogContent className="sm:max-w-[400px] bg-zinc-950 border border-zinc-800 text-zinc-100">
						<DialogHeader>
							<DialogTitle className="text-lg text-red-400">
								🗑️ Flush Redis
							</DialogTitle>
							<DialogDescription className="text-zinc-400">
								This will permanently delete all data in Redis
								including trade history, stats, and active
								trades. This action cannot be undone.
							</DialogDescription>
						</DialogHeader>
						<DialogFooter className="gap-2 sm:gap-0">
							<DialogClose asChild>
								<Button
									variant="outline"
									className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
								>
									Cancel
								</Button>
							</DialogClose>
							<DialogClose asChild>
								<Button
									variant="destructive"
									className="bg-red-600 hover:bg-red-700 text-white"
									onClick={() =>
										flushRedis.mutate(undefined, {
											onSuccess: () =>
												refetchRedisStats(),
										})
									}
								>
									Yes, Flush All Data
								</Button>
							</DialogClose>
						</DialogFooter>
					</DialogContent>
				</Dialog>
				<Dialog>
					<DialogTrigger asChild>
						<Badge
							variant="outline"
							className="text-xs border-zinc-700 text-zinc-400 cursor-pointer hover:bg-zinc-800 transition-colors"
						>
							{config?.mode?.toUpperCase() || 'LOADING'} MODE
						</Badge>
					</DialogTrigger>
					<DialogContent className="sm:max-w-[425px] bg-zinc-950 border border-zinc-800 text-zinc-100">
						<DialogHeader>
							<DialogTitle className="text-xl">
								Bot Configuration
							</DialogTitle>
						</DialogHeader>
						{config ? (
							<div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
								<div className="space-y-2">
									<h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
										Trading Limits
									</h3>
									<div className="grid grid-cols-2 gap-2 text-sm">
										<span className="text-zinc-500">
											Min Order Size
										</span>
										<span className="text-right">
											${config.minOrderSizeUsd}
										</span>
										<span className="text-zinc-500">
											Max Order Size
										</span>
										<span className="text-right">
											${config.maxOrderSizeUsd}
										</span>
										<span className="text-zinc-500">
											Max Open Trades
										</span>
										<span className="text-right">
											{config.maxConcurrentTrades}
										</span>
										<span className="text-zinc-500">
											Bot Allowance
										</span>
										<span className="text-right">
											${config.botAllowance}
										</span>
									</div>
								</div>
								<div className="space-y-2">
									<h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
										Strategy Guards
									</h3>
									<div className="grid grid-cols-2 gap-2 text-sm">
										<span className="text-zinc-500">
											Min Confidence
										</span>
										<span className="text-right">
											{config.confidenceThreshold * 100}%
										</span>
										<span className="text-zinc-500">
											Min Entry Price
										</span>
										<span className="text-right">
											${config.minEntryPrice}
										</span>
										<span className="text-zinc-500">
											Min Market Age
										</span>
										<span className="text-right">
											{config.minMarketAgeMinutes} min
										</span>
										<span className="text-zinc-500">
											Take Profit
										</span>
										<span className="text-right">
											+{config.takeProfitPct * 100}%
										</span>
										<span className="text-zinc-500">
											Stop Loss
										</span>
										<span className="text-right">
											-{config.stopLossPct * 100}%
										</span>
									</div>
								</div>
								<div className="space-y-2">
									<h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
										Technical Analysis
									</h3>
									<div className="grid grid-cols-2 gap-2 text-sm">
										<span className="text-zinc-500">
											Candles Fetched
										</span>
										<span className="text-right">
											{config.candleCount}
										</span>
										<span className="text-zinc-500">
											RSI Period
										</span>
										<span className="text-right">
											{config.rsiPeriod}
										</span>
										<span className="text-zinc-500">
											EMA Fast
										</span>
										<span className="text-right">
											{config.emaFast}
										</span>
										<span className="text-zinc-500">
											EMA Slow
										</span>
										<span className="text-right">
											{config.emaSlow}
										</span>
									</div>
								</div>
							</div>
						) : (
							<div className="py-8 text-center text-zinc-500 animate-pulse">
								Loading configuration...
							</div>
						)}
					</DialogContent>
				</Dialog>
			</div>
		</div>
	);
}
