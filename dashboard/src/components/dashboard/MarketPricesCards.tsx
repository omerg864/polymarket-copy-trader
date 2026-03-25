import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
} from '@/components/ui/card';
import { useActiveTrades, useMarketPrices } from '@/hooks/use-api';
import { MarketOutcomeBadge } from './badges';

const fmtPrice = (n: number | undefined) =>
	n?.toLocaleString(undefined, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});

const fmtTime = (ts: number) =>
	new Date(ts).toLocaleTimeString(undefined, {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	});

export function MarketPricesCards() {
	const { data: marketPrices } = useMarketPrices();
	const { data: activeTrades } = useActiveTrades();

	if (!marketPrices?.btcPrice) return null;

	const {
		btcPrice,
		updatedAt,
		marketTitle,
		upPrice,
		downPrice,
		indicators,
		confidence,
		direction,
		indicatorsUpdatedAt,
	} = marketPrices;

	// Check if there's an active trade for this market
	const hasActiveTrade = activeTrades?.some(
		(t) => t.status === 'open' && t.title === marketTitle,
	);

	const getValColor = (pass?: boolean) => pass === true ? 'text-emerald-400' : pass === false ? 'text-red-400' : 'text-zinc-200';

	return (
		<div className="space-y-4 mb-4">
			<div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-4">
				<Card className="bg-zinc-900 border-zinc-800">
					<CardHeader className="pb-2">
						<CardDescription className="text-xs text-zinc-500">
							₿ BTC Price
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-bold font-mono text-zinc-100">
							${fmtPrice(btcPrice)}
						</p>
						{updatedAt && (
							<p className="text-xs text-zinc-500 mt-1">
								Updated {fmtTime(updatedAt)}
							</p>
						)}
					</CardContent>
				</Card>

				{upPrice !== null && (
					<Card className="bg-zinc-900 border-zinc-800">
						<CardHeader className="pb-2">
							<CardDescription className="text-xs">
								<MarketOutcomeBadge
									outcome="UP"
									className="pb-0"
								/>
							</CardDescription>
						</CardHeader>
						<CardContent>
							<p className="text-2xl font-bold font-mono text-emerald-400">
								${upPrice.toFixed(3)}
							</p>
							<p className="text-xs text-zinc-500 mt-1">
								Current "Yes" price
							</p>
						</CardContent>
					</Card>
				)}

				{downPrice !== null && (
					<Card className="bg-zinc-900 border-zinc-800">
						<CardHeader className="pb-2">
							<CardDescription className="text-xs text-zinc-500">
								<MarketOutcomeBadge
									outcome="DOWN"
									className="pb-0"
								/>
							</CardDescription>
						</CardHeader>
						<CardContent>
							<p className="text-2xl font-bold font-mono text-red-400">
								${downPrice.toFixed(3)}
							</p>
							<p className="text-xs text-zinc-500 mt-1">
								Current "No" price
							</p>
						</CardContent>
					</Card>
				)}
			</div>

			{indicators && !hasActiveTrade && (
				<Card className="bg-zinc-900 border-zinc-800 border-t-amber-500/50">
					<CardHeader className="pb-2 text-zinc-100">
						<div className="flex justify-between items-center">
							<div>
								<CardDescription className="text-xs font-semibold text-amber-500 uppercase tracking-wider">
									📊 Live Signal Analysis
								</CardDescription>
								{indicatorsUpdatedAt && (
									<p className="text-[10px] text-zinc-500">
										Updated: {fmtTime(indicatorsUpdatedAt)}
									</p>
								)}
							</div>
							<div className="text-right flex items-center gap-3">
								<div className="flex flex-col items-end">
									<div className="flex items-center gap-1.5">
										<span className={`text-xs font-bold ${direction === 'UP' ? 'text-emerald-400' : 'text-red-400'}`}>
											{direction === 'UP' ? '▲ BUY UP' : '▼ BUY DOWN'}
										</span>
										<span
											className={`text-sm font-bold font-mono ${
												confidence! > 0.7
													? 'text-emerald-400'
													: confidence! > 0.5
														? 'text-amber-400'
														: 'text-zinc-400'
											}`}
										>
											{(confidence! * 100).toFixed(1)}%
										</span>
									</div>
									<div className="w-32 h-1.5 bg-zinc-800 rounded-full mt-1 overflow-hidden flex">
										<div 
											className={`h-full transition-all duration-500 ${direction === 'UP' ? 'bg-emerald-500 ml-auto' : 'bg-red-500 mr-auto'}`}
											style={{ width: `${confidence! * 100}%` }}
										/>
									</div>
								</div>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 text-[10px] sm:text-xs">
							<div className="space-y-1">
								<p className="text-zinc-500 uppercase">RSI (14)</p>
								<p className={`font-mono font-semibold ${getValColor(indicators.rsi14Pass)}`}>
									{indicators.rsi14 || '—'}
								</p>
							</div>
							<div className="space-y-1">
								<p className="text-zinc-500 uppercase">StochRSI</p>
								<p className={`font-mono font-semibold ${getValColor(indicators.stochRsiPass)}`}>
									{indicators.stochRsi || '—'}
								</p>
							</div>
							<div className="space-y-1">
								<p className="text-zinc-500 uppercase">BB Pos</p>
								<p className={`font-mono font-semibold ${getValColor(indicators.bbPositionPass)}`}>
									{indicators.bbPosition || '—'}
								</p>
							</div>
							<div className="space-y-1">
								<p className="text-zinc-500 uppercase">BTC Price</p>
								<p className={`font-mono font-semibold ${getValColor(indicators.entryPricePass)}`}>
									${Number(indicators.currentPrice).toLocaleString()}
								</p>
							</div>
							<div className="space-y-1">
								<p className="text-zinc-500 uppercase">Market Price</p>
								<p className={`font-mono font-semibold ${getValColor(indicators.marketPricePass)}`}>
									{direction === 'UP' 
										? (upPrice !== null ? upPrice.toFixed(3) : '—') 
										: (downPrice !== null ? downPrice.toFixed(3) : '—')}
								</p>
							</div>
							<div className="space-y-1">
								<p className="text-zinc-500 uppercase">Time Status</p>
								<p className={`font-mono font-semibold ${getValColor(indicators.timeFramePass)}`}>
									{indicators.timeRemaining || '—'}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
