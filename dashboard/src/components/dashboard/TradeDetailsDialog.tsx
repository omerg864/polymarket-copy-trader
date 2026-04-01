import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import type { Trade } from '@/types';
import {
	DirectionBadge,
	MarketOutcomeBadge,
	PnlBadge,
	StatusBadge,
} from './badges';
import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useConfig } from '@/hooks/use-api';
import {
	formatBtcPrice,
	formatGlobalDateTime,
} from '@/lib/utils';

interface TradeDetailsDialogProps {
	trade: Trade | null;
	onClose: () => void;
}

export function TradeDetailsDialog({
	trade,
	onClose,
}: TradeDetailsDialogProps) {
	const { data: config } = useConfig();
	const timezone = config?.timezone || 'Asia/Jerusalem';
	const [copied, setCopied] = useState(false);

	if (!trade) return null;

	const copyToClipboard = () => {
		navigator.clipboard.writeText(trade.id);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const formatWithTimezone = (iso: string | undefined) => {
		return formatGlobalDateTime(iso, timezone);
	};

	return (
		<Dialog open={!!trade} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-[425px] bg-zinc-950 border border-zinc-800 text-zinc-100">
				<DialogHeader>
					<DialogTitle className="text-xl flex items-center gap-2">
						Trade Details
						<StatusBadge status={trade.status} />
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
					<div className="space-y-2">
						<h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
							Execution
						</h3>
						<div className="grid grid-cols-2 gap-2 text-sm">
							<span className="text-zinc-500">Market</span>
							<span className="text-right font-mono text-xs">
								{trade.title.replace(
									'Bitcoin Up or Down - ',
									'',
								)}
							</span>
							<span className="text-zinc-500">Trade ID</span>
							<div className="flex items-center justify-end gap-2">
								<span className="font-mono text-[10px] text-zinc-500 truncate max-w-[120px]">
									{trade.id}
								</span>
								<button
									onClick={copyToClipboard}
									className="p-1 hover:bg-zinc-800 rounded transition-colors text-zinc-400 hover:text-zinc-100"
									title="Copy Trade ID"
								>
									{copied ? (
										<Check className="w-3 h-3 text-emerald-500" />
									) : (
										<Copy className="w-3 h-3" />
									)}
								</button>
							</div>
							<span className="text-zinc-500">Direction</span>
							<span className="text-right">
								<DirectionBadge direction={trade.direction} />
							</span>
							<span className="text-zinc-500">Shares</span>
							<span className="text-right font-mono">
								{trade.size.toLocaleString()}
							</span>
							<span className="text-zinc-500">Cost</span>
							<span className="text-right font-mono">
								${trade.cost.toFixed(2)}
							</span>
							<span className="text-zinc-500">Confidence</span>
							<span className="text-right font-mono">
								{trade.confidence
									? `${(trade.confidence * 100).toFixed(1)}%`
									: '—'}
							</span>
							<span className="text-zinc-500">Opened At</span>
							<span className="text-right text-xs text-zinc-400">
								{formatWithTimezone(trade.enteredAt)}
							</span>
							<span className="text-zinc-500">Closed At</span>
							<span className="text-right text-xs text-zinc-400">
								{formatWithTimezone(trade.closedAt)}
							</span>
						</div>
					</div>

					<div className="space-y-2">
						<h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
							Price & Result
						</h3>
						<div className="grid grid-cols-2 gap-2 text-sm">
							<span className="text-zinc-500">Entry Price</span>
							<span className="text-right font-mono">
								${trade.entryPrice.toFixed(3)}
							</span>
							<span className="text-zinc-500">Exit Price</span>
							<span className="text-right font-mono">
								{trade.exitPrice != null
									? `$${trade.exitPrice.toFixed(3)}`
									: '—'}
							</span>
							<span className="text-zinc-500">Fee</span>
							<span className="text-right font-mono text-orange-400">
								{trade.fee
									? `$${trade.fee.toFixed(4)} (${((trade.fee / trade.cost) * 100).toFixed(2)}%)`
									: '—'}
							</span>
							<span className="text-zinc-500">
								P&L Before Fee
							</span>
							<span className="text-right">
								<PnlBadge
									pnl={trade.pnl + (trade.fee || 0)}
									cost={trade.cost}
								/>
							</span>
							<span className="text-zinc-500">P&L</span>
							<span className="text-right">
								<PnlBadge pnl={trade.pnl} cost={trade.cost} />
							</span>
							<span className="text-zinc-500">Result Money</span>
							<span className="text-right font-mono text-zinc-300">
								${(trade.cost + trade.pnl).toFixed(2)}
							</span>
							<span className="text-zinc-500">
								Market Outcome
							</span>
							<span className="text-right">
								<MarketOutcomeBadge
									outcome={trade.actualOutcome}
								/>
							</span>
						</div>
					</div>

					{trade.indicators && (
						<div className="space-y-2">
							<h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
								Technical Indicators
							</h3>
							<div className="grid grid-cols-2 gap-2 text-sm">
								{trade.exitBtcPrice != null && (
									<>
										<span className="text-zinc-500">
											Exit BTC Price
										</span>
										<span className="text-right font-mono text-zinc-300">
											${formatBtcPrice(trade.exitBtcPrice)}
										</span>
										<span className="text-zinc-500">
											BTC Diff
										</span>
										<span
											className={`text-right font-mono ${
												trade.exitBtcPrice -
													trade.priceToBeat >=
												0
													? 'text-emerald-400'
													: 'text-red-400'
											}`}
										>
											{trade.exitBtcPrice -
												trade.priceToBeat >=
											0
												? '+'
												: ''}
											{formatBtcPrice(
												trade.exitBtcPrice -
													trade.priceToBeat,
											)}
										</span>
									</>
								)}
								<span className="text-zinc-500">
									Analysis BTC Price
								</span>
								<span className="text-right font-mono">
									${formatBtcPrice(trade.indicators.analysisBtcPrice)}
								</span>
								<span className="text-zinc-500">
									Entry BTC Price
								</span>
								<span className="text-right font-mono">
									${formatBtcPrice(trade.indicators.currentPrice)}
								</span>
								<span className="text-zinc-500">
									Analysis BTC Diff
								</span>
								<span
									className={`text-right font-mono ${
										trade.indicators.currentPrice -
											trade.indicators.analysisBtcPrice >=
										0
											? 'text-emerald-400'
											: 'text-red-400'
									}`}
								>
									{trade.indicators.currentPrice -
										trade.indicators.analysisBtcPrice >=
									0
										? '+'
										: ''}
									{formatBtcPrice(
										trade.indicators.currentPrice -
											trade.indicators.analysisBtcPrice,
									)}
								</span>
								<span className="text-zinc-500">
									Price to Beat
								</span>
								<span className="text-right font-mono">
									{trade.indicators.priceToBeat === 'N/A' || !trade.indicators.priceToBeat
										? 'N/A'
										: `$${formatBtcPrice(trade.indicators.priceToBeat)}`}
								</span>
								<span className="text-zinc-500">
									Entry BTC Diff
								</span>
								<span
									className={`text-right font-mono ${
										trade.indicators.currentPrice -
											Number(
												trade.indicators.priceToBeat,
											) >=
										0
											? 'text-emerald-400'
											: 'text-red-400'
									}`}
								>
									{trade.indicators.currentPrice -
										Number(trade.indicators.priceToBeat) >=
									0
										? '+'
										: ''}
											{formatBtcPrice(
										trade.indicators.currentPrice -
											Number(trade.indicators.priceToBeat),
									)}
								</span>
								<span className="text-zinc-500">
									Dist From Ref
								</span>
								<span className="text-right font-mono">
									{trade.indicators.distFromRef}
								</span>
								<span className="text-zinc-500">VWAP</span>
								<span className="text-right font-mono">
									{trade.indicators.vwap || '—'}
								</span>
								<span className="text-zinc-500">StochRSI</span>
								<span className="text-right font-mono">
									{trade.indicators.stochRsi || '—'}
								</span>
								<span className="text-zinc-500">Micro RSI</span>
								<span className="text-right font-mono">
									{trade.indicators.microRsi}
								</span>
								<span className="text-zinc-500">
									14-Period RSI
								</span>
								<span className="text-right font-mono">
									{trade.indicators.rsi14}
								</span>
								<span className="text-zinc-500">
									EMA 3 / EMA 8
								</span>
								<span className="text-right font-mono">
									{trade.indicators.ema3} /{' '}
									{trade.indicators.ema8}
								</span>
								<span className="text-zinc-500">
									BB Lower / Middle / Upper
								</span>
								<span className="text-right font-mono">
									{trade.indicators.bbLower || '—'} /{' '}
									{trade.indicators.bbMiddle || '—'} /{' '}
									{trade.indicators.bbUpper || '—'}
								</span>
								<span className="text-zinc-500">
									BB Position
								</span>
								<span className="text-right font-mono">
									{trade.indicators.bbPosition || '—'}
								</span>
								<span className="text-zinc-500">
									Momentum (3m)
								</span>
								<span className="text-right font-mono">
									{trade.indicators.momentum3}
								</span>
								<span className="text-zinc-500">
									Volatility
								</span>
								<span className="text-right font-mono">
									{trade.indicators.volatility}
								</span>
							</div>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
