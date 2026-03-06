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
import { useTradeHistory } from '@/hooks/use-api';
import { useMemoizedFn } from 'ahooks';
import type { Trade } from '@/types';
import { DirectionBadge, PnlBadge, StatusBadge } from './badges';
import { formatDate } from '@/lib/utils';

type SortField = 'time' | 'pnl' | 'confidence' | 'cost';
type SortDir = 'asc' | 'desc';
type FilterStatus = 'all' | 'won' | 'lost' | 'closed_tp' | 'closed_sl';

export function TradeHistoryTable() {
	const { data: history } = useTradeHistory();

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
								setFilterStatus(e.target.value as FilterStatus)
							}
							className="bg-zinc-800 text-zinc-300 text-xs rounded px-2 py-1.5 border border-zinc-700 outline-none"
						>
							<option value="all">All Statuses</option>
							<option value="won">🏆 Won</option>
							<option value="lost">❌ Lost</option>
							<option value="closed_tp">🟢 Take Profit</option>
							<option value="closed_sl">🔴 Stop Loss</option>
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
									className="border-zinc-800"
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
										${(trade.cost + trade.pnl).toFixed(2)}
									</TableCell>
									<TableCell>
										<StatusBadge status={trade.status} />
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
	);
}
