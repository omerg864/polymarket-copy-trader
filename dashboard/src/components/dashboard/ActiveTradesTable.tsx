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
import { useActiveTrades, useConfig } from '@/hooks/use-api';
import type { Trade } from '@/types';
import { useState } from 'react';
import { DirectionBadge } from './badges';
import { TradeDetailsDialog } from './TradeDetailsDialog';
import { formatGlobalDateTime } from '@/lib/utils';

export function ActiveTradesTable() {
	const { data: activeTrades } = useActiveTrades();
	const { data: config } = useConfig();
	const timezone = config?.timezone || 'Asia/Jerusalem';
	const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

	const formatWithTimezone = (iso: string | undefined) => {
		return formatGlobalDateTime(iso, timezone);
	};

	if (!activeTrades || activeTrades.length === 0) return null;

	return (
		<Card className="bg-zinc-900 border-zinc-800">
			<CardHeader>
				<CardTitle className="text-lg">
					⏳ Active Trades ({activeTrades.length})
				</CardTitle>
				<CardDescription className="text-zinc-500">
					Currently open positions — prices update every 5s
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="overflow-x-auto">
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
							{activeTrades.map((trade: Trade) => {
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
										className="border-zinc-800 cursor-pointer hover:bg-zinc-800/50 transition-colors"
										onClick={() => setSelectedTrade(trade)}
									>
										<TableCell className="font-mono text-xs text-zinc-400 max-w-[140px] truncate">
											{trade.title.replace(
												'Bitcoin Up or Down - ',
												'',
											)}
										</TableCell>
										<TableCell className="text-xs text-zinc-500">
											{formatWithTimezone(trade.enteredAt)}
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
											$
											{trade.currentPrice?.toFixed(3) ??
												'—'}
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
				</div>
			</CardContent>

			<TradeDetailsDialog
				trade={selectedTrade}
				onClose={() => setSelectedTrade(null)}
			/>
		</Card>
	);
}
