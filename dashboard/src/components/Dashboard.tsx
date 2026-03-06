import { useState, useMemo } from 'react';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
	useSummary,
	useActiveTrades,
	useTradeHistory,
	useToggleStop,
} from '@/hooks/use-api';
import type { Trade } from '@/types';
import { Button } from '@/components/ui/button';

function formatDate(iso: string) {
	return new Date(iso).toLocaleDateString([], {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	});
}

function PnlBadge({ pnl, cost }: { pnl: number; cost?: number }) {
	const pctChg = cost ? (pnl / cost) * 100 : 0;
	const pctStr =
		cost && pnl !== 0
			? ` (${pctChg > 0 ? '+' : ''}${pctChg.toFixed(1)}%)`
			: '';

	if (pnl > 0)
		return (
			<Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
				+${pnl.toFixed(2)}
				{pctStr}
			</Badge>
		);
	if (pnl < 0)
		return (
			<Badge className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/20">
				-${Math.abs(pnl).toFixed(2)}
				{pctStr}
			</Badge>
		);
	return <Badge variant="secondary">$0.00{cost ? ' (0.0%)' : ''}</Badge>;
}

function DirectionBadge({ direction }: { direction: string }) {
	return direction === 'UP' ? (
		<Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
			▲ UP
		</Badge>
	) : (
		<Badge className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/20">
			▼ DOWN
		</Badge>
	);
}

function StatusBadge({ status }: { status: string }) {
	const map: Record<string, { label: string; cls: string }> = {
		won: {
			label: '🏆 Won',
			cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
		},
		lost: {
			label: '❌ Lost',
			cls: 'bg-red-500/20 text-red-400 border-red-500/30',
		},
		open: {
			label: '⏳ Open',
			cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
		},
		closed_tp: {
			label: '🟢 Take Profit',
			cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
		},
		closed_sl: {
			label: '🔴 Stop Loss',
			cls: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
		},
		closed_sell: {
			label: '💰 Sold',
			cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
		},
	};
	const s = map[status];
	if (s)
		return <Badge className={`${s.cls} hover:${s.cls}`}>{s.label}</Badge>;
	return <Badge variant="outline">{status}</Badge>;
}

type SortField = 'time' | 'pnl' | 'confidence' | 'cost';
type SortDir = 'asc' | 'desc';
type FilterStatus = 'all' | 'won' | 'lost' | 'closed_tp' | 'closed_sl';

export function Dashboard() {
	const {
		data: summary,
		isLoading: summaryLoading,
		refetch: refetchSummary,
	} = useSummary();
	const { data: activeTrades } = useActiveTrades();
	const { data: history } = useTradeHistory();
	const toggleStop = useToggleStop();

	const [sortField, setSortField] = useState<SortField>('time');
	const [sortDir, setSortDir] = useState<SortDir>('desc');
	const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
	const [filterDir, setFilterDir] = useState<'all' | 'UP' | 'DOWN'>('all');

	const toggleSort = (field: SortField) => {
		if (sortField === field) {
			setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
		} else {
			setSortField(field);
			setSortDir('desc');
		}
	};

	const sortIndicator = (field: SortField) =>
		sortField === field ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

	const filteredHistory = useMemo(() => {
		if (!history) return [];
		let result = [...history];

		if (filterStatus !== 'all') {
			result = result.filter((t) => t.status === filterStatus);
		}
		if (filterDir !== 'all') {
			result = result.filter((t) => t.direction === filterDir);
		}

		result.sort((a, b) => {
			let cmp = 0;
			switch (sortField) {
				case 'time':
					cmp =
						new Date(a.closedAt ?? a.enteredAt).getTime() -
						new Date(b.closedAt ?? b.enteredAt).getTime();
					break;
				case 'pnl':
					cmp = a.pnl - b.pnl;
					break;
				case 'confidence':
					cmp = (a.confidence ?? 0) - (b.confidence ?? 0);
					break;
				case 'cost':
					cmp = a.cost - b.cost;
					break;
			}
			return sortDir === 'asc' ? cmp : -cmp;
		});

		return result;
	}, [history, sortField, sortDir, filterStatus, filterDir]);

	if (summaryLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-zinc-950">
				<div className="text-zinc-400 text-lg animate-pulse">
					Loading dashboard...
				</div>
			</div>
		);
	}

	const winRate = summary ? parseFloat(summary.winRate) : 0;
	const totalPnl = summary?.totalPnl ?? 0;
	const initialBalance = summary?.initialBalance ?? 100;
	const pnlPercentage =
		initialBalance > 0 ? (totalPnl / initialBalance) * 100 : 0;

	return (
		<div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
			<div className="max-w-7xl mx-auto space-y-6">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-bold tracking-tight">
							📊 Polymarket Trading Dashboard
						</h1>
						<p className="text-sm text-zinc-500 mt-1">
							BTC 5-Minute Up/Down Markets • Auto-refreshes every
							5s
						</p>
					</div>
					<div className="flex items-center gap-4">
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
						<Badge
							variant="outline"
							className="text-xs border-zinc-700 text-zinc-400"
						>
							DEMO MODE
						</Badge>
					</div>
				</div>

				{/* Summary Cards */}
				<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
					<Card className="bg-zinc-900 border-zinc-800">
						<CardHeader className="pb-2">
							<CardDescription className="text-xs text-zinc-500">
								Balance
							</CardDescription>
						</CardHeader>
						<CardContent>
							<p className="text-2xl font-bold font-mono">
								${summary?.balance.toFixed(2)}
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
								{summary?.winRate}%
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
								{summary?.totalTrades}
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
									{summary?.wins}
								</span>
								<span className="text-zinc-600"> / </span>
								<span className="text-red-400">
									{summary?.losses}
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
								{summary?.activeTrades}
							</p>
						</CardContent>
					</Card>
				</div>

				{/* Active Trades */}
				{activeTrades && activeTrades.length > 0 && (
					<Card className="bg-zinc-900 border-zinc-800">
						<CardHeader>
							<CardTitle className="text-lg">
								⏳ Active Trades ({activeTrades.length})
							</CardTitle>
							<CardDescription className="text-zinc-500">
								Currently open positions — prices update every
								5s
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Table>
								<TableHeader>
									<TableRow className="border-zinc-800 hover:bg-transparent">
										<TableHead className="text-zinc-500">
											Market
										</TableHead>
										<TableHead className="text-zinc-500">
											Entered
										</TableHead>
										<TableHead className="text-zinc-500">
											Direction
										</TableHead>
										<TableHead className="text-zinc-500">
											Shares
										</TableHead>
										<TableHead className="text-zinc-500">
											Entry
										</TableHead>
										<TableHead className="text-zinc-500">
											Current
										</TableHead>
										<TableHead className="text-zinc-500">
											Change
										</TableHead>
										<TableHead className="text-zinc-500">
											Cost
										</TableHead>
										<TableHead className="text-zinc-500">
											Confidence
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{activeTrades.map((trade) => {
										const pctChg =
											trade.entryPrice > 0
												? ((trade.currentPrice -
														trade.entryPrice) /
														trade.entryPrice) *
													100
												: 0;
										return (
											<TableRow
												key={trade.id}
												className="border-zinc-800"
											>
												<TableCell className="font-mono text-xs text-zinc-400">
													{trade.title.replace(
														'Bitcoin Up or Down - ',
														'',
													)}
												</TableCell>
												<TableCell className="text-xs text-zinc-500">
													{trade.enteredAt
														? formatDate(
																trade.enteredAt,
															)
														: '—'}
												</TableCell>
												<TableCell>
													<DirectionBadge
														direction={
															trade.direction
														}
													/>
												</TableCell>
												<TableCell className="font-mono text-sm">
													{trade.size.toLocaleString()}
												</TableCell>
												<TableCell className="font-mono text-sm">
													$
													{trade.entryPrice.toFixed(
														3,
													)}
												</TableCell>
												<TableCell className="font-mono text-sm">
													$
													{trade.currentPrice.toFixed(
														3,
													)}
												</TableCell>
												<TableCell>
													<span
														className={`font-mono text-sm ${
															pctChg >= 0
																? 'text-emerald-400'
																: 'text-red-400'
														}`}
													>
														{pctChg >= 0 ? '+' : ''}
														{pctChg.toFixed(1)}%
													</span>
												</TableCell>
												<TableCell className="font-mono text-sm">
													${trade.cost.toFixed(2)}
												</TableCell>
												<TableCell className="font-mono text-sm">
													{trade.confidence
														? `${(trade.confidence * 100).toFixed(0)}%`
														: '—'}
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				)}

				{/* Trade History */}
				<Card className="bg-zinc-900 border-zinc-800">
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle className="text-lg">
									📋 Trade History ({filteredHistory.length})
								</CardTitle>
								<CardDescription className="text-zinc-500">
									Completed trades with outcomes
								</CardDescription>
							</div>
							<div className="flex gap-2">
								<select
									value={filterStatus}
									onChange={(e) =>
										setFilterStatus(
											e.target.value as FilterStatus,
										)
									}
									className="bg-zinc-800 text-zinc-300 text-xs rounded px-2 py-1.5 border border-zinc-700 outline-none"
								>
									<option value="all">All Statuses</option>
									<option value="won">🏆 Won</option>
									<option value="lost">❌ Lost</option>
									<option value="closed_tp">
										🟢 Take Profit
									</option>
									<option value="closed_sl">
										🔴 Stop Loss
									</option>
								</select>
								<select
									value={filterDir}
									onChange={(e) =>
										setFilterDir(
											e.target.value as
												| 'all'
												| 'UP'
												| 'DOWN',
										)
									}
									className="bg-zinc-800 text-zinc-300 text-xs rounded px-2 py-1.5 border border-zinc-700 outline-none"
								>
									<option value="all">All Directions</option>
									<option value="UP">▲ UP</option>
									<option value="DOWN">▼ DOWN</option>
								</select>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						{filteredHistory.length > 0 ? (
							<Table>
								<TableHeader>
									<TableRow className="border-zinc-800 hover:bg-transparent">
										<TableHead
											className="text-zinc-500 cursor-pointer select-none hover:text-zinc-300"
											onClick={() => toggleSort('time')}
										>
											Closed{sortIndicator('time')}
										</TableHead>
										<TableHead className="text-zinc-500">
											Opened
										</TableHead>
										<TableHead className="text-zinc-500">
											Market
										</TableHead>
										<TableHead className="text-zinc-500">
											Direction
										</TableHead>
										<TableHead className="text-zinc-500">
											Shares
										</TableHead>
										<TableHead className="text-zinc-500">
											Entry
										</TableHead>
										<TableHead className="text-zinc-500">
											Exit
										</TableHead>
										<TableHead
											className="text-zinc-500 cursor-pointer select-none hover:text-zinc-300"
											onClick={() => toggleSort('cost')}
										>
											Cost{sortIndicator('cost')}
										</TableHead>
										<TableHead
											className="text-zinc-500 cursor-pointer select-none hover:text-zinc-300"
											onClick={() =>
												toggleSort('confidence')
											}
										>
											Confidence
											{sortIndicator('confidence')}
										</TableHead>
										<TableHead
											className="text-zinc-500 cursor-pointer select-none hover:text-zinc-300"
											onClick={() => toggleSort('pnl')}
										>
											P&L{sortIndicator('pnl')}
										</TableHead>
										<TableHead className="text-zinc-500">
											Result
										</TableHead>
										<TableHead className="text-zinc-500">
											Status
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{filteredHistory.map((trade: Trade) => (
										<TableRow
											key={trade.id}
											className="border-zinc-800"
										>
											<TableCell className="text-xs text-zinc-500">
												{trade.closedAt
													? formatDate(trade.closedAt)
													: '—'}
											</TableCell>
											<TableCell className="text-xs text-zinc-500">
												{trade.enteredAt
													? formatDate(
															trade.enteredAt,
														)
													: '—'}
											</TableCell>
											<TableCell className="font-mono text-xs text-zinc-400">
												{trade.title.replace(
													'Bitcoin Up or Down - ',
													'',
												)}
											</TableCell>
											<TableCell>
												<DirectionBadge
													direction={trade.direction}
												/>
											</TableCell>
											<TableCell className="font-mono text-sm">
												{trade.size.toLocaleString()}
											</TableCell>
											<TableCell className="font-mono text-sm">
												${trade.entryPrice.toFixed(3)}
											</TableCell>
											<TableCell className="font-mono text-sm">
												{trade.exitPrice != null
													? `$${trade.exitPrice.toFixed(3)}`
													: '—'}
											</TableCell>
											<TableCell className="font-mono text-sm">
												${trade.cost.toFixed(2)}
											</TableCell>
											<TableCell className="font-mono text-sm">
												{trade.confidence
													? `${(trade.confidence * 100).toFixed(0)}%`
													: '—'}
											</TableCell>
											<TableCell>
												<PnlBadge
													pnl={trade.pnl}
													cost={trade.cost}
												/>
											</TableCell>
											<TableCell className="font-mono text-sm text-zinc-300">
												$
												{(
													trade.cost + trade.pnl
												).toFixed(2)}
											</TableCell>
											<TableCell>
												<StatusBadge
													status={trade.status}
												/>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						) : (
							<p className="text-zinc-500 text-sm py-8 text-center">
								No trades match the current filters.
							</p>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
