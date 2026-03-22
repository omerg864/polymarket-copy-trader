import {
	createChart,
	ColorType,
	type IChartApi,
	type ISeriesApi,
	CandlestickSeries,
	type SeriesMarker,
	type Time,
	createSeriesMarkers,
	type MouseEventParams,
	type CandlestickData,
} from 'lightweight-charts';
import React, { useEffect, useRef, useState } from 'react';
import type { PriceCandle, Trade } from '@/types';
import { DateTime } from 'luxon';

interface CandlestickChartProps {
	data: PriceCandle[];
	trades?: Trade[];
	onTradeClick?: (trade: Trade) => void;
	timezone?: string;
	className?: string;
}

interface SeriesMarkersPlugin {
	setMarkers(markers: SeriesMarker<Time>[]): void;
	detach(): void;
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
	data,
	trades,
	onTradeClick,
	timezone = 'UTC',
	className,
}) => {
	const chartContainerRef = useRef<HTMLDivElement>(null);
	const chartRef = useRef<IChartApi | null>(null);
	const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
	const markersPluginRef = useRef<SeriesMarkersPlugin | null>(null);
	const [hoveredCandle, setHoveredCandle] = useState<PriceCandle | null>(
		null,
	);

	useEffect(() => {
		if (!chartContainerRef.current) return;

		const chart = createChart(chartContainerRef.current, {
			layout: {
				background: { type: ColorType.Solid, color: 'transparent' },
				textColor: '#a1a1aa',
			},
			grid: {
				vertLines: { color: '#27272a' },
				horzLines: { color: '#27272a' },
			},
			width: chartContainerRef.current.clientWidth,
			height: 400,
			localization: {
				timeFormatter: (time: number) => {
					return DateTime.fromSeconds(time)
						.setZone(timezone)
						.toFormat('HH:mm:ss');
				},
			},
			timeScale: {
				borderColor: '#27272a',
				timeVisible: true,
				secondsVisible: false,
				tickMarkFormatter: (time: number) => {
					return DateTime.fromSeconds(time)
						.setZone(timezone)
						.toFormat('HH:mm');
				},
			},
		});

		const candlestickSeries = chart.addSeries(CandlestickSeries, {
			upColor: '#10b981',
			downColor: '#ef4444',
			borderVisible: false,
			wickUpColor: '#10b981',
			wickDownColor: '#ef4444',
		});

		chartRef.current = chart;
		seriesRef.current = candlestickSeries;

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
			if (markersPluginRef.current) {
				markersPluginRef.current.detach();
			}
			chart.remove();
			chartRef.current = null;
			seriesRef.current = null;
			markersPluginRef.current = null;
		};
	}, [timezone]);

	useEffect(() => {
		if (seriesRef.current && data) {
			seriesRef.current.setData(data as CandlestickData<Time>[]);

			if (trades && trades.length > 0 && data.length > 0) {
				const markers: SeriesMarker<Time>[] = trades
					.map((trade) => {
						// Ensure we parse the ISO string as UTC if no offset is present
						const tradeTime = DateTime.fromISO(trade.enteredAt, {
							zone: 'utc',
						}).toSeconds();
						const barTime = data.reduce((prev, curr) => {
							return curr.time <= tradeTime ? curr.time : prev;
						}, data[0].time);

						return {
							id: trade.id,
							time: barTime as Time,
							position: (trade.direction === 'UP'
								? 'belowBar'
								: 'aboveBar') as 'aboveBar' | 'belowBar',
							color: trade.pnl > 0 ? '#10b981' : '#ef4444',
							shape: (trade.direction === 'UP'
								? 'arrowUp'
								: 'arrowDown') as 'arrowUp' | 'arrowDown',
							text: `${trade.direction} @ ${trade.entryPrice.toFixed(0)}`,
						};
					})
					.sort((a, b) => (a.time as number) - (b.time as number));

				if (!markersPluginRef.current) {
					markersPluginRef.current = createSeriesMarkers(
						seriesRef.current,
						markers,
					);
				} else {
					markersPluginRef.current.setMarkers(markers);
				}
			} else if (markersPluginRef.current) {
				markersPluginRef.current.setMarkers([]);
			}

			// Subscribe to click events
			const handleClick = (param: MouseEventParams) => {
				const markerId = param.hoveredObjectId;
				if (markerId && onTradeClick && trades) {
					const clickedTrade = trades.find((t) => t.id === markerId);
					if (clickedTrade) {
						onTradeClick(clickedTrade);
					}
				}
			};

			chartRef.current?.subscribeClick(handleClick);

			// Subscribe to crosshair move for tooltip
			const handleCrosshairMove = (param: MouseEventParams) => {
				if (
					param.point === undefined ||
					!param.time ||
					param.point.x < 0 ||
					param.point.x >
						(chartContainerRef.current?.clientWidth || 0) ||
					param.point.y < 0 ||
					param.point.y >
						(chartContainerRef.current?.clientHeight || 0)
				) {
					setHoveredCandle(null);
				} else if (seriesRef.current) {
					const candle = param.seriesData.get(
						seriesRef.current,
					) as CandlestickData<Time>;
					if (candle) {
						// Enrich with volume from the data array
						const originalData = data.find(
							(d) => d.time === param.time,
						);
						setHoveredCandle({
							...candle,
							time: param.time as number,
							volume: originalData?.volume,
						});
					}
				}
			};

			chartRef.current?.subscribeCrosshairMove(handleCrosshairMove);

			if (data.length > 0) {
				chartRef.current?.timeScale().fitContent();
			}

			return () => {
				chartRef.current?.unsubscribeClick(handleClick);
				chartRef.current?.unsubscribeCrosshairMove(handleCrosshairMove);
			};
		}
	}, [data, trades, onTradeClick, timezone]);

	return (
		<div
			className={`relative w-full bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-4 ${className}`}
		>
			{hoveredCandle && (
				<div className="absolute top-6 left-6 z-10 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-mono select-none pointer-events-none bg-zinc-950/80 backdrop-blur-sm p-2 rounded-lg border border-zinc-800 shadow-xl">
					<div className="text-zinc-500 flex items-center gap-1.5">
						<span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
						{DateTime.fromSeconds(hoveredCandle.time as number)
							.setZone(timezone)
							.toFormat('MMM d, HH:mm')}
					</div>
					<div className="flex gap-3">
						<div className="flex gap-1">
							<span className="text-zinc-500">O</span>
							<span className="text-zinc-200">
								{hoveredCandle.open.toFixed(2)}
							</span>
						</div>
						<div className="flex gap-1">
							<span className="text-zinc-500">H</span>
							<span className="text-zinc-200">
								{hoveredCandle.high.toFixed(2)}
							</span>
						</div>
						<div className="flex gap-1">
							<span className="text-zinc-500">L</span>
							<span className="text-zinc-200">
								{hoveredCandle.low.toFixed(2)}
							</span>
						</div>
						<div className="flex gap-1">
							<span className="text-zinc-500">C</span>
							<span
								className={`font-bold ${hoveredCandle.close >= hoveredCandle.open ? 'text-emerald-400' : 'text-red-400'}`}
							>
								{hoveredCandle.close.toFixed(2)}
							</span>
						</div>
						{hoveredCandle.volume !== undefined && (
							<div className="flex gap-1">
								<span className="text-zinc-500">V</span>
								<span className="text-zinc-400">
									{hoveredCandle.volume > 1000
										? `${(hoveredCandle.volume / 1000).toFixed(1)}k`
										: hoveredCandle.volume.toFixed(0)}
								</span>
							</div>
						)}
					</div>
				</div>
			)}
			<div ref={chartContainerRef} className="w-full h-[400px]" />
		</div>
	);
};
