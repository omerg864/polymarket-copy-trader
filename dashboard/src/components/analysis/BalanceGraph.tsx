import React, { useEffect, useRef, useMemo } from 'react';
import {
	createChart,
	ColorType,
	type IChartApi,
	type ISeriesApi,
	AreaSeries,
	type Time,
} from 'lightweight-charts';
import type { Trade, StrategyConfig } from '@/types';
import { TradeStatus } from '@shared/types';
import { DateTime } from 'luxon';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Wallet } from 'lucide-react';

interface BalanceGraphProps {
	trades: Trade[];
	config?: StrategyConfig;
	timezone?: string;
	className?: string;
}

export const BalanceGraph: React.FC<BalanceGraphProps> = ({
	trades,
	config,
	timezone = 'UTC',
	className,
}) => {
	const chartContainerRef = useRef<HTMLDivElement>(null);
	const chartRef = useRef<IChartApi | null>(null);
	const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);

	const initialBalance = config?.botAllowance ?? 0;

	// Process trade data into hourly balance points
	const chartData = useMemo(() => {
		if (!trades.length) return [];

		// 1. Filter only closed trades and sort by close time (fallback to enteredAt)
		const closedTrades = trades
			.filter((t) => t.status !== TradeStatus.OPEN)
			.map((t) => ({
				pnl: t.pnl || 0,
				time: DateTime.fromISO(t.closedAt || t.enteredAt).toMillis(),
			}))
			.sort((a, b) => a.time - b.time);

		if (closedTrades.length === 0) return [];

		// 2. Calculate cumulative balance at each trade closure
		const balancePoints: { time: number; balance: number }[] = [];
		let currentBalance = initialBalance;
		for (const t of closedTrades) {
			currentBalance += t.pnl;
			balancePoints.push({
				time: t.time,
				balance: currentBalance,
			});
		}

		// 3. Resample into hourly snapshots to ensure a continuous line
		const hourlyData: { time: Time; value: number }[] = [];
		const firstTime = DateTime.fromMillis(balancePoints[0].time).setZone(timezone).startOf('hour');
		const lastTime = DateTime.fromMillis(balancePoints[balancePoints.length - 1].time).setZone(timezone).endOf('hour');

		let runner = firstTime;
		let lastBalance = initialBalance;
		let pointIdx = 0;

		// Start with an initial point one hour before the first trade to show the baseline Clearly
		const startTime = firstTime.minus({ hours: 1 });
		hourlyData.push({
			time: (startTime.toMillis() / 1000) as Time,
			value: initialBalance,
		});

		while (runner <= lastTime) {
			const hourEnd = runner.endOf('hour').toMillis();

			// Update lastBalance with all trades that closed within this hour
			while (pointIdx < balancePoints.length && balancePoints[pointIdx].time <= hourEnd) {
				lastBalance = balancePoints[pointIdx].balance;
				pointIdx++;
			}

			hourlyData.push({
				time: (runner.toMillis() / 1000) as Time,
				value: lastBalance,
			});

			runner = runner.plus({ hours: 1 });
		}

		// Final check: Remove any duplicate timestamps just in case of weird timezone/DST edge cases
		return hourlyData.filter((item, index, self) => 
			index === 0 || item.time > self[index - 1].time
		);
	}, [trades, initialBalance, timezone]);

	useEffect(() => {
		if (!chartContainerRef.current) return;

		const chart = createChart(chartContainerRef.current, {
			layout: {
				background: { type: ColorType.Solid, color: 'transparent' },
				textColor: '#a1a1aa',
				fontFamily: 'Inter, system-ui, sans-serif',
			},
			grid: {
				vertLines: { color: 'rgba(39, 39, 42, 0.5)' },
				horzLines: { color: 'rgba(39, 39, 42, 0.5)' },
			},
			width: chartContainerRef.current.clientWidth,
			height: 300,
			rightPriceScale: {
				borderColor: 'rgba(39, 39, 42, 0.5)',
				scaleMargins: {
					top: 0.2,
					bottom: 0.2,
				},
			},
			timeScale: {
				borderColor: 'rgba(39, 39, 42, 0.5)',
				timeVisible: true,
				secondsVisible: false,
			},
			localization: {
				priceFormatter: (price: number) => `$${price.toFixed(2)}`,
				timeFormatter: (time: number) => {
					return DateTime.fromSeconds(time).setZone(timezone).toFormat('MMM d, HH:mm');
				},
			},
		});

		const areaSeries = chart.addSeries(AreaSeries, {
			lineColor: '#6366f1', // Indigo 500
			topColor: 'rgba(99, 102, 241, 0.4)',
			bottomColor: 'rgba(99, 102, 241, 0.05)',
			lineWidth: 2,
			priceFormat: {
				type: 'price',
				precision: 2,
				minMove: 0.01,
			},
		});

		chartRef.current = chart;
		seriesRef.current = areaSeries;

		const handleResize = () => {
			if (chartContainerRef.current) {
				chart.applyOptions({
					width: chartContainerRef.current.clientWidth,
				});
			}
		};

		window.addEventListener('resize', handleResize);

		return () => {
			window.removeEventListener('resize', handleResize);
			chart.remove();
			chartRef.current = null;
			seriesRef.current = null;
		};
	}, [timezone]);

	useEffect(() => {
		if (seriesRef.current && chartData.length > 0) {
			seriesRef.current.setData(chartData);
			chartRef.current?.timeScale().fitContent();
		}
	}, [chartData]);

	const currentProgress = chartData.length > 0 ? chartData[chartData.length - 1].value - initialBalance : 0;
	const progressPercent = initialBalance > 0 ? (currentProgress / initialBalance) * 100 : 0;
	const isProfit = currentProgress >= 0;

	return (
		<Card className={`bg-zinc-900 border-zinc-800 shadow-2xl relative overflow-hidden group ${className}`}>
			<div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
				<TrendingUp className="h-24 w-24 text-zinc-100" />
			</div>

			<CardHeader className="pb-2">
				<div className="flex justify-between items-center">
					<div className="space-y-1">
						<CardTitle className="text-xl font-bold flex items-center gap-2 text-zinc-100">
							<Wallet className="h-5 w-5 text-indigo-400" />
							Account Growth
						</CardTitle>
						<div className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
							Hourly Balance (Closed Trades)
						</div>
					</div>
					<div className="text-right">
						<div className={`text-2xl font-black font-mono tracking-tight ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
							{isProfit ? '+' : ''}${currentProgress.toFixed(2)}
						</div>
						<div className={`text-[10px] font-bold uppercase tracking-widest ${isProfit ? 'text-emerald-500/70' : 'text-red-500/70'}`}>
							{progressPercent.toFixed(2)}% ROI
						</div>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<div ref={chartContainerRef} className="w-full h-[300px] mt-2" />
			</CardContent>
		</Card>
	);
};
