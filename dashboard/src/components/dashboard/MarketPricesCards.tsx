import { useEffect, useState } from 'react';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
} from '@/components/ui/card';
import { useActiveTrades, useMarketPrices, useConfig } from '@/hooks/use-api';
import { MarketOutcomeBadge } from './badges';
import { formatBtcPrice, formatGlobalTime } from '@/lib/utils';


const formatElapsed = (seconds: number) => {
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export function MarketPricesCards() {
	const { data: marketPrices } = useMarketPrices();
	const { data: activeTrades } = useActiveTrades();
	const { data: sc } = useConfig();
	const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

	useEffect(() => {
		const timer = setInterval(() => {
			if (
				marketPrices?.marketStartTime &&
				new Date() <= new Date(marketPrices.marketEndTime ?? 0 + 1000)
			) {
				const elapsed = Math.max(
					0,
					Math.floor(
						(Date.now() - marketPrices.marketStartTime) / 1000,
					),
				);
				setElapsedSeconds(elapsed);
			}
		}, 1000);
		return () => clearInterval(timer);
	}, [marketPrices?.marketStartTime]);

	if (!marketPrices?.btcPrice) return null;

	const {
		btcPrice,
		priceToBeat,
		updatedAt,
		marketTitle,
		upPrice,
		downPrice,
		indicators,
		confidence,
		direction,
		indicatorsUpdatedAt,
		marketStartTime,
	} = marketPrices;

	// Check if there's an active trade for this market
	const hasActiveTrade = activeTrades?.some(
		(t) => t.status === 'open' && t.title === marketTitle,
	);

	const getValColor = (pass?: boolean) =>
		pass === true
			? 'text-emerald-400'
			: pass === false
				? 'text-red-400'
				: 'text-zinc-200';

	// Market Age Guard Calculation
	const minAgeSeconds = (sc?.minMarketAgeMinutes || 0) * 60;
	const isAgePass =
		elapsedSeconds >= minAgeSeconds &&
		elapsedSeconds <= 5 * 60 - (sc?.minSecondsRemaining ?? 0);
	const timeStatusColor = isAgePass ? 'text-emerald-400' : 'text-red-400';

	const diff = priceToBeat !== null ? btcPrice - priceToBeat : null;
	const pctDiff =
		priceToBeat && priceToBeat > 0 ? (diff! / priceToBeat) * 100 : null;
	const isPriceWinning = diff !== null ? diff >= 0 : true;
	const priceColor = isPriceWinning ? 'text-emerald-400' : 'text-red-400';

	return (
		<div className="space-y-4 mb-4">
			<div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-4">
				<Card className="bg-zinc-900 border-zinc-800">
					<CardHeader className="pb-2">
						<CardDescription className="text-xs text-zinc-500">
							₿ BTC Price
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p
							className={`text-2xl font-bold font-mono ${priceColor}`}
						>
							${formatBtcPrice(btcPrice)}
						</p>
						<div className="flex flex-col mt-2 gap-1.5">
							<div className="flex justify-between items-center text-[10px]">
								<span className="text-zinc-500 uppercase tracking-wider">
									Updated
								</span>
								<span className="text-zinc-400 font-mono italic">
									{updatedAt ? formatGlobalTime(updatedAt, sc?.timezone || 'Asia/Jerusalem') : '—'}
								</span>
							</div>
							{diff !== null && (
								<div className="flex justify-between items-center text-[10px]">
									<span className="text-zinc-500 uppercase tracking-wider">
										Diff
									</span>
									<span
										className={`font-mono font-bold ${priceColor}`}
									>
										{diff >= 0 ? '+' : ''}${formatBtcPrice(diff)}{' '}
										({diff >= 0 ? '+' : ''}
										{pctDiff?.toFixed(2)}%)
									</span>
								</div>
							)}
						</div>
					</CardContent>
				</Card>

				{priceToBeat !== null && (
					<Card className="bg-zinc-900 border-zinc-800">
						<CardHeader className="pb-2">
							<CardDescription className="text-xs text-zinc-500">
								🎯 Price to Beat
							</CardDescription>
						</CardHeader>
						<CardContent>
							<p className="text-2xl font-bold font-mono text-zinc-300">
								${formatBtcPrice(priceToBeat)}
							</p>
							<div className="flex flex-col mt-0.5">
								<p className="text-[10px] text-zinc-500 truncate leading-tight">
									{marketTitle || 'BTC Market'}
								</p>
								<p className="text-[9px] text-zinc-600 font-medium uppercase tracking-wider">
									Ref BTC Price
								</p>
							</div>
						</CardContent>
					</Card>
				)}

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
										Updated: {formatGlobalTime(indicatorsUpdatedAt, sc?.timezone || 'Asia/Jerusalem')}
									</p>
								)}
							</div>
							<div className="text-right flex items-center gap-3">
								<div className="flex flex-col items-end">
									<div className="flex items-center gap-1.5">
										<span
											className={`text-xs font-bold ${direction === 'UP' ? 'text-emerald-400' : 'text-red-400'}`}
										>
											{direction === 'UP'
												? '▲ BUY UP'
												: '▼ BUY DOWN'}
										</span>
										<span
											className={`text-sm font-bold font-mono ${
												(confidence ?? 0) * 100 >
												(sc?.minConfidence ?? 0)
													? 'text-emerald-400'
													: 'text-red-400'
											}`}
										>
											{((confidence ?? 0) * 100).toFixed(
												1,
											)}
											%
										</span>
									</div>
									<div className="w-32 h-1.5 bg-zinc-800 rounded-full mt-1 overflow-hidden flex">
										<div
											className={`h-full transition-all duration-500 ${direction === 'UP' ? 'bg-emerald-500 ml-auto' : 'bg-red-500 mr-auto'}`}
											style={{
												width: `${(confidence ?? 0) * 100}%`,
											}}
										/>
									</div>
								</div>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-4 text-[10px] sm:text-xs">
							<div className="space-y-1">
								<p className="text-zinc-500 uppercase">
									RSI (14)
								</p>
								<p
									className={`font-mono font-semibold ${getValColor(indicators.rsi14Pass)}`}
								>
									{indicators.rsi14 || '—'}
								</p>
							</div>
							<div className="space-y-1">
								<p className="text-zinc-500 uppercase">
									StochRSI
								</p>
								<p
									className={`font-mono font-semibold ${getValColor(indicators.stochRsiPass)}`}
								>
									{indicators.stochRsi || '—'}
								</p>
							</div>
							<div className="space-y-1">
								<p className="text-zinc-500 uppercase">
									BB Pos
								</p>
								<p
									className={`font-mono font-semibold ${getValColor(indicators.bbPositionPass)}`}
								>
									{indicators.bbPosition || '—'}
								</p>
							</div>
							<div className="space-y-1">
								<p className="text-zinc-500 uppercase">
									BTC Price
								</p>
								<p
									className={`font-mono font-semibold ${getValColor(indicators.entryPricePass)}`}
								>
									${formatBtcPrice(indicators.currentPrice)}
								</p>
							</div>
							<div className="space-y-1">
								<p className="text-zinc-500 uppercase">
									Market Price
								</p>
								<p
									className={`font-mono font-semibold ${getValColor(indicators.marketPricePass)}`}
								>
									{direction === 'UP'
										? upPrice !== null
											? upPrice.toFixed(3)
											: '—'
										: downPrice !== null
											? downPrice.toFixed(3)
											: '—'}
								</p>
							</div>
							<div className="space-y-1">
								<p className="text-zinc-500 uppercase">
									Time Status
								</p>
								<p
									className={`font-mono font-semibold ${timeStatusColor}`}
								>
									{marketStartTime
										? formatElapsed(elapsedSeconds)
										: '—'}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
