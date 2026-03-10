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
	getAuthRole,
	useConfig,
	useFlushRedis,
	useRedisStats,
	useSummary,
	useToggleStop,
	useTradeHistory,
	useUpdateConfig,
} from '@/hooks/use-api';
import type { StrategyConfig } from '@/types';
import { useMemoizedFn } from 'ahooks';
import { saveAs } from 'file-saver';
import { Database, Pencil } from 'lucide-react';
import { useState } from 'react';
import * as XLSX from 'xlsx';
import { HeaderClocks } from './HeaderClocks';

export function Header() {
	const { data: summary, refetch: refetchSummary } = useSummary();
	const { data: history } = useTradeHistory();
	const { data: config, refetch: refetchConfig } = useConfig();
	const toggleStop = useToggleStop();
	const { data: redisStats, refetch: refetchRedisStats } = useRedisStats();
	const flushRedis = useFlushRedis();
	const updateConfig = useUpdateConfig();
	const isReadonly = getAuthRole() === 'readonly';
	const isAdmin = getAuthRole() === 'admin';

	const [editing, setEditing] = useState(false);
	const [editValues, setEditValues] = useState<Partial<StrategyConfig>>({});
	const [configOpen, setConfigOpen] = useState(false);

	const resetEditValues = () => {
		if (config) {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { mode: _, ...strategy } = config;
			setEditValues(strategy);
		}
		setEditing(false);
	};

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
						} transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
						onClick={() =>
							toggleStop.mutate(!summary.isStopping, {
								onSuccess: () => refetchSummary(),
							})
						}
						disabled={toggleStop.isPending || isReadonly}
						title={isReadonly ? 'Admin access required' : undefined}
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
							className="h-7 px-3 text-xs font-medium rounded border bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20 hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							disabled={flushRedis.isPending || isReadonly}
							title={
								isReadonly ? 'Admin access required' : undefined
							}
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
				<Dialog
					open={configOpen}
					onOpenChange={(open) => {
						setConfigOpen(open);
						if (open) resetEditValues();
					}}
				>
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
							<DialogTitle className="text-xl flex items-center justify-between">
								Bot Configuration
								{isAdmin && !editing && (
									<Button
										variant="ghost"
										size="sm"
										className="h-7 px-2 text-zinc-400 hover:text-zinc-200"
										onClick={() => setEditing(true)}
									>
										<Pencil className="h-3.5 w-3.5 mr-1" />
										Edit
									</Button>
								)}
							</DialogTitle>
						</DialogHeader>
						{config ? (
							<div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
								<ConfigSection title="Trading Limits">
									<ConfigRow
										label="Min Order Size"
										field="minOrderSizeUsd"
										prefix="$"
										editing={editing}
										editValues={editValues}
										setEditValues={setEditValues}
									/>
									<ConfigRow
										label="Max Order Size"
										field="maxOrderSizeUsd"
										prefix="$"
										editing={editing}
										editValues={editValues}
										setEditValues={setEditValues}
									/>
									<ConfigRow
										label="Max Open Trades"
										field="maxConcurrentTrades"
										editing={editing}
										editValues={editValues}
										setEditValues={setEditValues}
									/>
									<ConfigRow
										label="Bot Allowance"
										field="botAllowance"
										prefix="$"
										editing={editing}
										editValues={editValues}
										setEditValues={setEditValues}
									/>
								</ConfigSection>
								<ConfigSection title="Strategy Guards">
									<ConfigRow
										label="Min Confidence"
										field="confidenceThreshold"
										editing={editing}
										editValues={editValues}
										setEditValues={setEditValues}
									/>
									<ConfigRow
										label="Min Entry Price"
										field="minEntryPrice"
										prefix="$"
										editing={editing}
										editValues={editValues}
										setEditValues={setEditValues}
									/>
									<ConfigRow
										label="Max Entry Price"
										field="maxEntryPrice"
										prefix="$"
										editing={editing}
										editValues={editValues}
										setEditValues={setEditValues}
									/>
									<ConfigRow
										label="Min StochRSI"
										field="minStochRSI"
										editing={editing}
										editValues={editValues}
										setEditValues={setEditValues}
									/>
									<ConfigRow
										label="Max StochRSI"
										field="maxStochRSI"
										editing={editing}
										editValues={editValues}
										setEditValues={setEditValues}
									/>
									<ConfigRow
										label="Min Market Age"
										field="minMarketAgeMinutes"
										suffix=" min"
										editing={editing}
										editValues={editValues}
										setEditValues={setEditValues}
									/>
									<ConfigRow
										label="Take Profit"
										field="takeProfitPct"
										editing={editing}
										editValues={editValues}
										setEditValues={setEditValues}
									/>
									<ConfigRow
										label="Stop Loss"
										field="stopLossPct"
										editing={editing}
										editValues={editValues}
										setEditValues={setEditValues}
									/>
									<ConfigRow
										label="Force Close Before End"
										field="maxSecLoseFct"
										suffix="s"
										editing={editing}
										editValues={editValues}
										setEditValues={setEditValues}
									/>
								</ConfigSection>
								<ConfigSection title="Technical Analysis">
									<ConfigRow
										label="Candles Fetched"
										field="candleCount"
										editing={editing}
										editValues={editValues}
										setEditValues={setEditValues}
									/>
									<ConfigRow
										label="RSI Period"
										field="rsiPeriod"
										editing={editing}
										editValues={editValues}
										setEditValues={setEditValues}
									/>
									<ConfigRow
										label="EMA Fast"
										field="emaFast"
										editing={editing}
										editValues={editValues}
										setEditValues={setEditValues}
									/>
									<ConfigRow
										label="EMA Slow"
										field="emaSlow"
										editing={editing}
										editValues={editValues}
										setEditValues={setEditValues}
									/>
								</ConfigSection>
								<ConfigSection title="Advanced">
									<ConfigRow
										label="Risk Monitor Interval"
										field="riskMonitorIntervalMs"
										suffix=" ms"
										editing={editing}
										editValues={editValues}
										setEditValues={setEditValues}
									/>
									<ConfigRow
										label="High Price Threshold"
										field="highPriceThreshold"
										prefix="$"
										editing={editing}
										editValues={editValues}
										setEditValues={setEditValues}
									/>
									<ConfigRow
										label="High Price Bonus"
										field="highPriceMaxBonusPct"
										editing={editing}
										editValues={editValues}
										setEditValues={setEditValues}
									/>
									<ConfigRow
										label="Cycle Interval"
										field="cycleIntervalMs"
										suffix=" ms"
										editing={editing}
										editValues={editValues}
										setEditValues={setEditValues}
									/>
								</ConfigSection>
							</div>
						) : (
							<div className="py-8 text-center text-zinc-500 animate-pulse">
								Loading configuration...
							</div>
						)}
						{editing && (
							<DialogFooter className="gap-2 sm:gap-0">
								<Button
									variant="outline"
									className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
									onClick={() => {
										resetEditValues();
									}}
								>
									Cancel
								</Button>
								<Button
									className="bg-blue-600 hover:bg-blue-700 text-white"
									disabled={updateConfig.isPending}
									onClick={() => {
										updateConfig.mutate(editValues, {
											onSuccess: () => {
												setEditing(false);
												refetchConfig();
											},
										});
									}}
								>
									{updateConfig.isPending
										? '⌛ Saving...'
										: 'Save Changes'}
								</Button>
							</DialogFooter>
						)}
					</DialogContent>
				</Dialog>
			</div>
		</div>
	);
}

function ConfigSection({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-2">
			<h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
				{title}
			</h3>
			<div className="grid grid-cols-2 gap-2 text-sm">{children}</div>
		</div>
	);
}

function ConfigRow({
	label,
	field,
	prefix,
	suffix,
	editing,
	editValues,
	setEditValues,
}: {
	label: string;
	field: keyof StrategyConfig;
	prefix?: string;
	suffix?: string;
	editing: boolean;
	editValues: Partial<StrategyConfig>;
	setEditValues: React.Dispatch<
		React.SetStateAction<Partial<StrategyConfig>>
	>;
}) {
	const value = editValues[field];

	if (editing) {
		return (
			<>
				<span className="text-zinc-500 flex items-center">{label}</span>
				<input
					type="number"
					step="any"
					value={value ?? ''}
					onChange={(e) =>
						setEditValues((prev: Partial<StrategyConfig>) => ({
							...prev,
							[field]: parseFloat(e.target.value) || 0,
						}))
					}
					className="w-full px-2 py-0.5 rounded border border-zinc-700 bg-zinc-800 text-zinc-100 text-right text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
				/>
			</>
		);
	}

	return (
		<>
			<span className="text-zinc-500">{label}</span>
			<span className="text-right">
				{prefix}
				{value}
				{suffix}
			</span>
		</>
	);
}
