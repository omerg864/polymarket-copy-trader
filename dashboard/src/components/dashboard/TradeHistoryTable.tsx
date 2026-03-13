import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { useTradeHistory } from '@/hooks/use-api';
import { formatDate } from '@/lib/utils';
import type { Trade } from '@/types';
import { useMemoizedFn } from 'ahooks';
import { useMemo, useState } from 'react';
import { DirectionBadge, PnlBadge, StatusBadge } from './badges';

type SortField = 'time' | 'pnl' | 'confidence' | 'cost';
type SortDir = 'asc' | 'desc';
type FilterStatus = 'all' | 'won' | 'lost' | 'closed_tp' | 'closed_sl' | 'closed_sell';

export function TradeHistoryTable() {
	const { data: history } = useTradeHistory();

	const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
	const [sortField, setSortField] = useState<SortField>('time');
	const [sortDir, setSortDir] = useState<SortDir>('desc');
	const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
	const [filterDir, setFilterDir] = useState<'all' | 'UP' | 'DOWN'>('all');

	const toggleSort = useMemoizedFn((field: SortField) => {
		if (sortField === field) {
			setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
		} else {
			setSortField(field);
			setSortDir('desc');
		}
	});

	const sortIndicator = useMemoizedFn((field: SortField) =>
		sortField === field ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '',
	);

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

	return (
		<Card className="bg-zinc-900 border-zinc-800">
			<CardHeader>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<CardTitle className="text-lg">
							📋 Trade History ({filteredHistory.length})
						</CardTitle>
						<CardDescription className="text-zinc-500">
							Completed trades with outcomes
						</CardDescription>
					</div>
					<div className="flex flex-wrap gap-2">
						<select
							value={filterStatus}
							onChange={(e) =>
								setFilterStatus(e.target.value as FilterStatus)
							}
							className="bg-zinc-800 text-zinc-300 text-xs rounded px-2 py-1.5 border border-zinc-700 outline-none"
						>
							<option value="all">All Statuses</option>
							<option value="won">🏆 Won</option>
							<option value="lost">❌ Lost</option>
							<option value="closed_tp">🟢 Take Profit</option>
							<option value="closed_sl">🔴 Stop Loss</option>
							<option value="closed_sell">💰 Sold</option>
						</select>
						<select
							value={filterDir}
							onChange={(e) =>
								setFilterDir(
									e.target.value as 'all' | 'UP' | 'DOWN',
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
					<div className="overflow-x-auto">
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
										onClick={() => toggleSort('confidence')}
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
										className="border-zinc-800 cursor-pointer hover:bg-zinc-800/50 transition-colors"
										onClick={() => setSelectedTrade(trade)}
									>
										<TableCell className="text-xs text-zinc-500">
											{trade.closedAt
												? formatDate(trade.closedAt)
												: '—'}
										</TableCell>
										<TableCell className="text-xs text-zinc-500">
											{trade.enteredAt
												? formatDate(trade.enteredAt)
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
												? `${(
														trade.confidence * 100
													).toFixed(0)}%`
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
											{(trade.cost + trade.pnl).toFixed(
												2,
											)}
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
					</div>
				) : (
					<p className="text-zinc-500 text-sm py-8 text-center">
						No trades match the current filters.
					</p>
				)}
			</CardContent>

			{/* Trade Details Dialog */}
			<Dialog
				open={!!selectedTrade}
				onOpenChange={(open) => !open && setSelectedTrade(null)}
			>
				<DialogContent className="sm:max-w-[425px] bg-zinc-950 border border-zinc-800 text-zinc-100">
					<DialogHeader>
						<DialogTitle className="text-xl flex items-center gap-2">
							Trade Details
							{selectedTrade && (
								<StatusBadge status={selectedTrade.status} />
							)}
						</DialogTitle>
					</DialogHeader>
					{selectedTrade && (
						<div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
							<div className="space-y-2">
								<h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
									Execution
								</h3>
								<div className="grid grid-cols-2 gap-2 text-sm">
									<span className="text-zinc-500">
										Market
									</span>
									<span className="text-right font-mono text-xs">
										{selectedTrade.title.replace(
											'Bitcoin Up or Down - ',
											'',
										)}
									</span>
									<span className="text-zinc-500">
										Direction
									</span>
									<span className="text-right">
										<DirectionBadge
											direction={selectedTrade.direction}
										/>
									</span>
									<span className="text-zinc-500">
										Shares
									</span>
									<span className="text-right font-mono">
										{selectedTrade.size.toLocaleString()}
									</span>
									<span className="text-zinc-500">Cost</span>
									<span className="text-right font-mono">
										${selectedTrade.cost.toFixed(2)}
									</span>
									<span className="text-zinc-500">
										Confidence
									</span>
									<span className="text-right font-mono">
										{selectedTrade.confidence
											? `${(selectedTrade.confidence * 100).toFixed(1)}%`
											: '—'}
									</span>
									<span className="text-zinc-500">
										Opened At
									</span>
									<span className="text-right text-xs text-zinc-400">
										{selectedTrade.enteredAt
											? formatDate(
													selectedTrade.enteredAt,
												)
											: '—'}
									</span>
									<span className="text-zinc-500">
										Closed At
									</span>
									<span className="text-right text-xs text-zinc-400">
										{selectedTrade.closedAt
											? formatDate(selectedTrade.closedAt)
											: '—'}
									</span>
								</div>
							</div>

							<div className="space-y-2">
								<h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
									Price & Result
								</h3>
								<div className="grid grid-cols-2 gap-2 text-sm">
									<span className="text-zinc-500">
										Entry Price
									</span>
									<span className="text-right font-mono">
										${selectedTrade.entryPrice.toFixed(3)}
									</span>
									<span className="text-zinc-500">
										Exit Price
									</span>
									<span className="text-right font-mono">
										{selectedTrade.exitPrice != null
											? `$${selectedTrade.exitPrice.toFixed(3)}`
											: '—'}
									</span>
									{selectedTrade.exitBtcPrice != null && (
										<>
											<span className="text-zinc-500">
												Exit BTC Price
											</span>
											<span className="text-right font-mono text-zinc-300">
												${selectedTrade.exitBtcPrice.toLocaleString(
													undefined,
													{
														minimumFractionDigits: 2,
														maximumFractionDigits: 2,
													},
												)}
											</span>
										</>
									)}
									<span className="text-zinc-500">Fee</span>
									<span className="text-right font-mono text-orange-400">
										{selectedTrade.fee
											? `$${selectedTrade.fee.toFixed(4)} (${((selectedTrade.fee / selectedTrade.cost) * 100).toFixed(2)}%)`
											: '—'}
									</span>
									<span className="text-zinc-500">
										P&L Before Fee
									</span>
									<span className="text-right">
										<PnlBadge
											pnl={
												selectedTrade.pnl +
												(selectedTrade.fee || 0)
											}
											cost={selectedTrade.cost}
										/>
									</span>
									<span className="text-zinc-500">P&L</span>
									<span className="text-right">
										<PnlBadge
											pnl={selectedTrade.pnl}
											cost={selectedTrade.cost}
										/>
									</span>
									<span className="text-zinc-500">
										Result Money
									</span>
									<span className="text-right font-mono text-zinc-300">
										$
										{(
											selectedTrade.cost +
											selectedTrade.pnl
										).toFixed(2)}
									</span>
								</div>
							</div>

							{selectedTrade.indicators && (
								<div className="space-y-2">
									<h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
										Technical Indicators
									</h3>
									<div className="grid grid-cols-2 gap-2 text-sm">
										<span className="text-zinc-500">
											Current Price
										</span>
										<span className="text-right font-mono">
											$
											{selectedTrade.indicators.currentPrice?.toFixed(
												2,
											) || '—'}
										</span>
										<span className="text-zinc-500">
											Price to Beat
										</span>
										<span className="text-right font-mono">
											{selectedTrade.indicators
												.priceToBeat === 'N/A'
												? 'N/A'
												: `$${Number(selectedTrade.indicators.priceToBeat).toFixed(2)}`}
										</span>
										<span className="text-zinc-500">
											Dist From Ref
										</span>
										<span className="text-right font-mono">
											{
												selectedTrade.indicators
													.distFromRef
											}
										</span>
										<span className="text-zinc-500">
											VWAP
										</span>
										<span className="text-right font-mono">
											{selectedTrade.indicators.vwap ||
												'—'}
										</span>
										<span className="text-zinc-500">
											StochRSI
										</span>
										<span className="text-right font-mono">
											{selectedTrade.indicators
												.stochRsi || '—'}
										</span>
										<span className="text-zinc-500">
											Micro RSI
										</span>
										<span className="text-right font-mono">
											{selectedTrade.indicators.microRsi}
										</span>
										<span className="text-zinc-500">
											14-Period RSI
										</span>
										<span className="text-right font-mono">
											{selectedTrade.indicators.rsi14}
										</span>
										<span className="text-zinc-500">
											EMA 3 / EMA 8
										</span>
										<span className="text-right font-mono">
											{selectedTrade.indicators.ema3} /{' '}
											{selectedTrade.indicators.ema8}
										</span>
										<span className="text-zinc-500">
											BB Lower / Middle / Upper
										</span>
										<span className="text-right font-mono">
											{selectedTrade.indicators.bbLower ||
												'—'}{' '}
											/{' '}
											{selectedTrade.indicators
												.bbMiddle || '—'}{' '}
											/{' '}
											{selectedTrade.indicators.bbUpper ||
												'—'}
										</span>
										<span className="text-zinc-500">
											BB Position
										</span>
										<span className="text-right font-mono">
											{selectedTrade.indicators
												.bbPosition || '—'}
										</span>
										<span className="text-zinc-500">
											Momentum (3m)
										</span>
										<span className="text-right font-mono">
											{selectedTrade.indicators.momentum3}
										</span>
										<span className="text-zinc-500">
											Volatility
										</span>
										<span className="text-right font-mono">
											{
												selectedTrade.indicators
													.volatility
											}
										</span>
									</div>
								</div>
							)}
						</div>
					)}
				</DialogContent>
			</Dialog>
		</Card>
	);
}
