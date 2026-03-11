/* eslint-disable @typescript-eslint/no-explicit-any */
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '@/components/ui/accordion';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { useConfig, useTradeHistory } from '@/hooks/use-api';
import type { Trade } from '@/types';
import { Lightbulb, Sparkles } from 'lucide-react';
import { useMemo } from 'react';

function calculateStats(trades: Trade[]) {
	const total = trades.length;
	const wins = trades.filter((t) => t.pnl > 0).length;
	const losses = trades.filter((t) => t.pnl <= 0).length;
	const winRate = total > 0 ? (wins / total) * 100 : 0;
	const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
	return { total, wins, losses, winRate, totalPnl };
}

// Helper to elegantly group trades into dual-layer intervals (e.g. 10-unit Parent buckets, 1-unit Child buckets)
function groupNestedInterval(
	trades: Trade[],
	getValue: (t: Trade) => number | undefined,
	parentInterval: number,
	childInterval: number,
	formatLabel: (start: number, end: number) => string = (s, e) =>
		`${s} - ${e}`,
	minVal: number = -Infinity,
	maxVal: number = Infinity,
) {
	const childGroupsMap: Record<string, Record<string, Trade[]>> = {};

	trades.forEach((t) => {
		let val = getValue(t);
		if (val === undefined || isNaN(val)) return;

		// Clamp the value to the min/max limits to prevent overflow
		val = Math.max(minVal, Math.min(maxVal, val));

		// 1. Calculate parent bucket (e.g. 80-89)
		let pStart = Math.floor(val / parentInterval) * parentInterval;
		if (pStart > maxVal) pStart = maxVal;
		const pEnd = Math.min(
			maxVal,
			pStart +
				parentInterval -
				(Number.isInteger(parentInterval) && parentInterval > 1
					? 1
					: 0.01),
		);
		const pKey = formatLabel(pStart, pEnd);

		// 2. Calculate child bucket (e.g. 81-81)
		const cStart = Math.floor(val / childInterval) * childInterval;
		const cEnd = Math.min(
			maxVal,
			cStart +
				childInterval -
				(Number.isInteger(childInterval) ? 1 : 0.01),
		);
		const cKey = formatLabel(cStart, cEnd);

		if (!childGroupsMap[pKey]) childGroupsMap[pKey] = {};
		if (!childGroupsMap[pKey][cKey]) childGroupsMap[pKey][cKey] = [];
		childGroupsMap[pKey][cKey].push(t);
	});

	// Assemble structure and sort
	return Object.entries(childGroupsMap)
		.sort(
			(a, b) =>
				parseFloat(a[0].split(/[^\d.-]/)[0] || '0') -
				parseFloat(b[0].split(/[^\d.-]/)[0] || '0'),
		)
		.map(([pKey, cMap]) => {
			const allParentTrades = Object.values(cMap).flat();

			const children = Object.entries(cMap)
				.sort(
					(a, b) =>
						parseFloat(a[0].split(/[^\d.-]/)[0] || '0') -
						parseFloat(b[0].split(/[^\d.-]/)[0] || '0'),
				)
				.map(([cKey, groupTrades]) => ({
					label: cKey,
					stats: calculateStats(groupTrades),
					upStats: calculateStats(
						groupTrades.filter((t) => t.direction === 'UP'),
					),
					downStats: calculateStats(
						groupTrades.filter((t) => t.direction === 'DOWN'),
					),
				}));

			return {
				label: pKey,
				main: calculateStats(allParentTrades),
				upStats: calculateStats(
					allParentTrades.filter((t) => t.direction === 'UP'),
				),
				downStats: calculateStats(
					allParentTrades.filter((t) => t.direction === 'DOWN'),
				),
				children,
			};
		});
}

export function AnalysisDashboard() {
	const { data: history, isLoading } = useTradeHistory();
	const { data: config } = useConfig();
	const dayPnlGoal = config?.dayPnlGoal ?? 2;

	const analysis = useMemo(() => {
		if (!history || history.length === 0) return null;

		// Only analyze resolved trades
		const resolved = history.filter(
			(t: Trade) =>
				t.status === 'won' ||
				t.status === 'lost' ||
				t.status === 'resolved' ||
				t.status === 'closed_tp' ||
				t.status === 'closed_sl' ||
				t.status === 'closed_sell',
		);

		const byConfidenceRaw = groupNestedInterval(
			resolved,
			(t) => {
				// Round the confidence cleanly to avoid floating point mismatch like 0.8999999
				const conf = (t.confidence || 0) * 100;
				return Math.round(conf);
			},
			10,
			1,
			(s, e) => `${s}% - ${e}%`,
			0, // min
			100, // max
		);
		const byConfidence = byConfidenceRaw.reduce(
			(acc, bucket) => {
				acc[bucket.label] = {
					main: bucket.main,
					upStats: bucket.upStats,
					downStats: bucket.downStats,
					children: bucket.children,
				};
				return acc;
			},
			{} as Record<
				string,
				{
					main: ReturnType<typeof calculateStats>;
					upStats: ReturnType<typeof calculateStats>;
					downStats: ReturnType<typeof calculateStats>;
					children: any[];
				}
			>,
		);

		// 2. By Entry Price
		const byPriceRaw = groupNestedInterval(
			resolved,
			(t) => t.entryPrice * 100,
			10,
			1,
			(s, e) => `${s}¢ - ${e}¢`,
		);
		const byPrice = byPriceRaw.reduce(
			(acc, bucket) => {
				acc[bucket.label] = {
					main: bucket.main,
					upStats: bucket.upStats,
					downStats: bucket.downStats,
					children: bucket.children,
				};
				return acc;
			},
			{} as Record<
				string,
				{
					main: ReturnType<typeof calculateStats>;
					upStats: ReturnType<typeof calculateStats>;
					downStats: ReturnType<typeof calculateStats>;
					children: any[];
				}
			>,
		);

		// Helper to safely extract StochRSI 'k' value
		const getStochRSI = (t: Trade) => {
			if (!t.indicators?.stochRsi) return undefined;
			const val = parseFloat(t.indicators.stochRsi);
			return isNaN(val) ? undefined : val;
		};

		// Helper to extract VWAP sentiment (BTC Price minus VWAP)
		const getVwapDist = (t: Trade) => {
			if (!t.indicators?.vwap || !t.indicators?.currentPrice)
				return undefined;
			const btcPrice = parseFloat(t.indicators.currentPrice.toString());
			const vwap = parseFloat(t.indicators.vwap);
			if (isNaN(btcPrice) || isNaN(vwap)) return undefined;
			// Returns % distance of BTC above/below VWAP
			return ((btcPrice - vwap) / vwap) * 100;
		};

		// Helper to extract Hour of Day
		const getHourOfDay = (t: Trade) => {
			if (!t.enteredAt) return undefined;
			return new Date(t.enteredAt).getHours();
		};

		// Helper to extract Day of Week (0=Sunday..6=Saturday)
		const getDayOfWeek = (t: Trade) => {
			if (!t.enteredAt) return undefined;
			return new Date(t.enteredAt).getDay();
		};
		const dayNames = [
			'Sunday',
			'Monday',
			'Tuesday',
			'Wednesday',
			'Thursday',
			'Friday',
			'Saturday',
		];

		// Helpers for additional indicators
		const getMicroRsi = (t: Trade) => {
			if (!t.indicators?.microRsi) return undefined;
			const val = parseFloat(t.indicators.microRsi);
			return isNaN(val) ? undefined : val;
		};

		const getRsi14 = (t: Trade) => {
			if (!t.indicators?.rsi14) return undefined;
			const val = parseFloat(t.indicators.rsi14);
			return isNaN(val) ? undefined : val;
		};

		const getEma3 = (t: Trade) => {
			if (!t.indicators?.ema3 || !t.indicators?.currentPrice)
				return undefined;
			const price = parseFloat(t.indicators.currentPrice.toString());
			const ema = parseFloat(t.indicators.ema3);
			if (isNaN(price) || isNaN(ema)) return undefined;
			return ((price - ema) / ema) * 100;
		};

		const getEma8 = (t: Trade) => {
			if (!t.indicators?.ema8 || !t.indicators?.currentPrice)
				return undefined;
			const price = parseFloat(t.indicators.currentPrice.toString());
			const ema = parseFloat(t.indicators.ema8);
			if (isNaN(price) || isNaN(ema)) return undefined;
			return ((price - ema) / ema) * 100;
		};

		const getBbPosition = (t: Trade) => {
			if (
				!t.indicators?.bbLower ||
				!t.indicators?.bbUpper ||
				!t.indicators?.currentPrice
			)
				return undefined;
			const price = parseFloat(t.indicators.currentPrice.toString());
			const lower = parseFloat(t.indicators.bbLower);
			const upper = parseFloat(t.indicators.bbUpper);
			if (isNaN(price) || isNaN(lower) || isNaN(upper) || upper === lower)
				return undefined;
			return ((price - lower) / (upper - lower)) * 100;
		};

		const getMomentum3 = (t: Trade) => {
			if (!t.indicators?.momentum3) return undefined;
			const val = parseFloat(t.indicators.momentum3);
			return isNaN(val) ? undefined : val;
		};

		const getVolatility = (t: Trade) => {
			if (!t.indicators?.volatility) return undefined;
			const val = parseFloat(t.indicators.volatility);
			return isNaN(val) ? undefined : val;
		};

		// 3. By StochRSI
		const stochRsiRaw = groupNestedInterval(
			resolved,
			getStochRSI,
			10,
			1,
			(s, e) => `${s} - ${e}`,
			0, // min
			100, // max
		);
		const byStochRSI = stochRsiRaw.reduce(
			(acc, bucket) => {
				acc[bucket.label] = {
					main: bucket.main,
					upStats: bucket.upStats,
					downStats: bucket.downStats,
					children: bucket.children,
				};
				return acc;
			},
			{} as Record<
				string,
				{
					main: ReturnType<typeof calculateStats>;
					upStats: ReturnType<typeof calculateStats>;
					downStats: ReturnType<typeof calculateStats>;
					children: any[];
				}
			>,
		);

		// 4. By VWAP Distance Percent
		const byVWAPRaw = groupNestedInterval(
			resolved,
			getVwapDist,
			0.5,
			0.1,
			(s, e) => `${s.toFixed(2)}% - ${e.toFixed(2)}%`,
		);
		const byVWAP = byVWAPRaw.reduce(
			(acc, bucket) => {
				acc[bucket.label] = {
					main: bucket.main,
					upStats: bucket.upStats,
					downStats: bucket.downStats,
					children: bucket.children,
				};
				return acc;
			},
			{} as Record<
				string,
				{
					main: ReturnType<typeof calculateStats>;
					upStats: ReturnType<typeof calculateStats>;
					downStats: ReturnType<typeof calculateStats>;
					children: any[];
				}
			>,
		);

		// VWAP Sentiment: Above vs Below
		const vwapAbove = resolved.filter((t) => (getVwapDist(t) ?? 0) > 0);
		const vwapBelow = resolved.filter((t) => (getVwapDist(t) ?? 0) < 0);
		const vwapSentiment = {
			above: calculateStats(vwapAbove),
			below: calculateStats(vwapBelow),
			avgDistAbove:
				vwapAbove.length > 0
					? vwapAbove.reduce((s, t) => s + (getVwapDist(t) ?? 0), 0) /
						vwapAbove.length
					: 0,
			avgDistBelow:
				vwapBelow.length > 0
					? vwapBelow.reduce((s, t) => s + (getVwapDist(t) ?? 0), 0) /
						vwapBelow.length
					: 0,
		};

		// 5. By Direction
		const byDirection = {
			UP: {
				main: calculateStats(
					resolved.filter((t: Trade) => t.direction === 'UP'),
				),
				children: [],
			},
			DOWN: {
				main: calculateStats(
					resolved.filter((t: Trade) => t.direction === 'DOWN'),
				),
				children: [],
			},
		};

		// Helper to extract Market Age in minutes
		const getMarketAge = (t: Trade) => {
			if (!t.startTime || !t.enteredAt) return undefined;
			const start = new Date(t.startTime).getTime();
			const entered = new Date(t.enteredAt).getTime();
			return (entered - start) / 60000;
		};

		// 6. By Market Age
		const mktAgeRaw = groupNestedInterval(
			resolved,
			getMarketAge,
			1,
			0.25,
			(s, _e) => `${s.toFixed(1)}m - ${_e.toFixed(1)}m`,
		);
		const byMarketAge = mktAgeRaw.reduce(
			(acc, bucket) => {
				acc[bucket.label] = {
					main: bucket.main,
					upStats: bucket.upStats,
					downStats: bucket.downStats,
					children: bucket.children,
				};
				return acc;
			},
			{} as Record<
				string,
				{
					main: ReturnType<typeof calculateStats>;
					upStats: ReturnType<typeof calculateStats>;
					downStats: ReturnType<typeof calculateStats>;
					children: any[];
				}
			>,
		);

		// 7. By Time of Day (Hour)
		const byTimeOfDayRaw = groupNestedInterval(
			resolved,
			getHourOfDay,
			4,
			1,
			(s, e) =>
				`${s.toString().padStart(2, '0')}:00 - ${Math.max(s, Math.min(23, e)).toString().padStart(2, '0')}:59`,
			0, // min (0:00)
			23, // max (23:00)
		);
		const byTimeOfDay = byTimeOfDayRaw.reduce(
			(acc, bucket) => {
				acc[bucket.label] = {
					main: bucket.main,
					upStats: bucket.upStats,
					downStats: bucket.downStats,
					children: bucket.children,
				};
				return acc;
			},
			{} as Record<
				string,
				{
					main: ReturnType<typeof calculateStats>;
					upStats: ReturnType<typeof calculateStats>;
					downStats: ReturnType<typeof calculateStats>;
					children: any[];
				}
			>,
		);

		return {
			total: calculateStats(resolved),
			confidence: byConfidence,
			price: byPrice,
			direction: byDirection,
			marketAge: byMarketAge,
			stochRSI: byStochRSI,
			vwap: byVWAP,
			vwapSentiment,
			timeOfDay: byTimeOfDay,
			dayOfWeek: dayNames
				.map((dayName, dayIdx) => {
					const dayTrades = resolved.filter(
						(t) => getDayOfWeek(t) === dayIdx,
					);
					const hourGroups: {
						label: string;
						stats: ReturnType<typeof calculateStats>;
						upStats: ReturnType<typeof calculateStats>;
						downStats: ReturnType<typeof calculateStats>;
					}[] = [];
					for (let h = 0; h < 24; h++) {
						const hourTrades = dayTrades.filter(
							(t) => getHourOfDay(t) === h,
						);
						if (hourTrades.length > 0) {
							hourGroups.push({
								label: `${h.toString().padStart(2, '0')}:00 - ${h.toString().padStart(2, '0')}:59`,
								stats: calculateStats(hourTrades),
								upStats: calculateStats(
									hourTrades.filter(
										(t) => t.direction === 'UP',
									),
								),
								downStats: calculateStats(
									hourTrades.filter(
										(t) => t.direction === 'DOWN',
									),
								),
							});
						}
					}
					return {
						label: dayName,
						main: calculateStats(dayTrades),
						upStats: calculateStats(
							dayTrades.filter((t) => t.direction === 'UP'),
						),
						downStats: calculateStats(
							dayTrades.filter((t) => t.direction === 'DOWN'),
						),
						children: hourGroups,
					};
				})
				.filter((d) => d.main.total > 0),
			microRsi: groupNestedInterval(
				resolved,
				getMicroRsi,
				10,
				2,
				(s, e) => `${s} - ${e}`,
				0,
				100,
			),
			rsi14: groupNestedInterval(
				resolved,
				getRsi14,
				10,
				2,
				(s, e) => `${s} - ${e}`,
				0,
				100,
			),
			ema3Dist: groupNestedInterval(
				resolved,
				getEma3,
				0.5,
				0.1,
				(s, e) => `${s.toFixed(2)}% - ${e.toFixed(2)}%`,
			),
			ema8Dist: groupNestedInterval(
				resolved,
				getEma8,
				0.5,
				0.1,
				(s, e) => `${s.toFixed(2)}% - ${e.toFixed(2)}%`,
			),
			bbPosition: groupNestedInterval(
				resolved,
				getBbPosition,
				20,
				5,
				(s, e) => `${s.toFixed(0)}% - ${e.toFixed(0)}%`,
				0,
				100,
			),
			momentum3: groupNestedInterval(
				resolved,
				getMomentum3,
				0.5,
				0.1,
				(s, e) => `${s.toFixed(2)}% - ${e.toFixed(2)}%`,
			),
			volatility: groupNestedInterval(
				resolved,
				getVolatility,
				0.5,
				0.1,
				(s, e) => `${s.toFixed(2)}% - ${e.toFixed(2)}%`,
			),
			byDate: (() => {
				const dateMap: Record<string, Trade[]> = {};
				resolved.forEach((t) => {
					if (!t.enteredAt) return;
					const d = new Date(t.enteredAt);
					const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
					if (!dateMap[dateKey]) dateMap[dateKey] = [];
					dateMap[dateKey].push(t);
				});
				return Object.entries(dateMap)
					.sort(([a], [b]) => a.localeCompare(b))
					.map(([date, trades]) => ({
						label: date,
						main: calculateStats(trades),
						upStats: calculateStats(
							trades.filter((t) => t.direction === 'UP'),
						),
						downStats: calculateStats(
							trades.filter((t) => t.direction === 'DOWN'),
						),
						children: [] as {
							label: string;
							stats: ReturnType<typeof calculateStats>;
							upStats: ReturnType<typeof calculateStats>;
							downStats: ReturnType<typeof calculateStats>;
						}[],
					}));
			})(),
		};
	}, [history]);

	if (isLoading) {
		return (
			<div className="p-8 text-center text-zinc-400">
				Loading analysis data...
			</div>
		);
	}

	if (!history || !analysis) {
		return (
			<div className="p-8 text-center text-zinc-400">
				Not enough trade history to perform analysis.
			</div>
		);
	}

	const suggestions: string[] = [];
	const resolvedBase = history.filter(
		(t: Trade) =>
			t.status === 'won' ||
			t.status === 'lost' ||
			t.status === 'resolved' ||
			t.status === 'closed_tp' ||
			t.status === 'closed_sl' ||
			t.status === 'closed_sell',
	);

	const lowConf = calculateStats(
		resolvedBase.filter((t: Trade) => (t.confidence || 0) < 0.7),
	);
	if (lowConf.total > 4 && lowConf.winRate < 45) {
		suggestions.push(
			'Trades below 70% confidence have a poor win rate. Consider strictly enforcing `CONFIDENCE_THRESHOLD=0.70` to reduce losses.',
		);
	} else if (lowConf.total > 4 && lowConf.winRate > 65) {
		suggestions.push(
			'Interestingly, trades below 70% confidence are highly profitable. You might be missing opportunities by filtering them out. Consider lowering `CONFIDENCE_THRESHOLD`.',
		);
	}

	const expensivePrice = calculateStats(
		resolvedBase.filter((t: Trade) => t.entryPrice >= 0.8),
	);
	if (expensivePrice.total > 4 && expensivePrice.winRate < 40) {
		suggestions.push(
			'Buying "expensive" entries (> 80¢) is resulting in a low win rate. Consider lowering `MIN_ENTRY_PRICE` or avoiding over-priced setups.',
		);
	}

	const upStats = analysis.direction['UP']?.main || { total: 0, winRate: 0 };
	const downStats = analysis.direction['DOWN']?.main || {
		total: 0,
		winRate: 0,
	};
	if (upStats.total > 4 && downStats.total > 4) {
		if (upStats.winRate - downStats.winRate > 20) {
			suggestions.push(
				'UP trades are significantly outperforming DOWN trades. The current market condition strongly favors bullish momentum.',
			);
		} else if (downStats.winRate - upStats.winRate > 20) {
			suggestions.push(
				'DOWN trades are significantly outperforming UP trades. The current market condition strongly favors bearish momentum.',
			);
		}
	}

	const lateAge = calculateStats(
		resolvedBase.filter((t: Trade) => {
			if (!t.startTime || !t.enteredAt) return false;
			return (
				(new Date(t.enteredAt).getTime() -
					new Date(t.startTime).getTime()) /
					60000 >=
				4
			);
		}),
	);
	if (lateAge.total > 4 && lateAge.winRate < 45) {
		suggestions.push(
			'Entering late into the 5-minute window (> 4m) is causing severe P&L bleed. Consider increasing `MIN_MARKET_AGE_MINUTES` or avoiding late jumps.',
		);
	}

	if (analysis.total.totalPnl < 0) {
		suggestions.push(
			'Overall P&L is negative. Review the worst performing buckets below and adjust confidence, price, or age bounds.',
		);
	} else if (analysis.total.totalPnl > 0 && analysis.total.winRate > 55) {
		suggestions.push(
			'The bot is currently highly profitable! The statistical edge is playing out nicely. Scale up `BOT_ALLOWANCE` cautiously.',
		);
	}

	if (suggestions.length === 0) {
		suggestions.push(
			'Not enough skewed data to form strong suggestions yet. Let the bot run longer to gather more statistical significance.',
		);
	}

	const renderStatRow = (
		label: string,
		stats: {
			total: number;
			wins: number;
			losses: number;
			winRate: number;
			totalPnl: number;
		},
		isChild: boolean = false,
	) => (
		<div
			key={label}
			className={`flex flex-wrap sm:flex-nowrap items-center justify-between py-2 border-b border-zinc-800/50 last:border-0 rounded -mx-2 px-2 gap-1 ${
				isChild ? 'bg-zinc-900/40 text-sm' : 'hover:bg-zinc-800/30'
			}`}
		>
			<span
				className={`${isChild ? 'text-zinc-400' : 'text-zinc-300 font-medium'} w-full sm:w-[30%] pl-2 truncate`}
				title={label}
			>
				{isChild && '↳ '}
				{label}
			</span>
			<span className="text-zinc-500 text-xs font-mono w-auto sm:w-[20%] text-center">
				{stats.total} trades
			</span>
			<span
				className={`font-mono font-medium text-xs w-auto sm:w-[20%] text-center ${stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
			>
				{stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(2)}
			</span>
			<div className="w-auto sm:w-[30%] text-right whitespace-nowrap">
				<span
					className={`font-mono font-bold ${stats.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'} ${isChild ? 'text-xs' : ''}`}
				>
					{stats.winRate.toFixed(1)}%
				</span>
				<span className="text-zinc-600 text-xs ml-1">
					({stats.wins}W/{stats.losses}L)
				</span>
			</div>
		</div>
	);

	const renderDirectionRows = (group: any) => {
		if (!group.upStats && !group.downStats) return null;
		const up = group.upStats;
		const down = group.downStats;
		if ((!up || up.total === 0) && (!down || down.total === 0)) return null;
		return (
			<>
				{up && up.total > 0 && renderStatRow('↑ UP', up, true)}
				{down && down.total > 0 && renderStatRow('↓ DOWN', down, true)}
			</>
		);
	};

	const renderAccordionCard = (
		title: string,
		description: string,
		data:
			| ReturnType<typeof groupNestedInterval>
			| Record<
					string,
					{
						main: ReturnType<typeof calculateStats>;
						children: any[];
					}
			  >,
		colSpan?: boolean,
	) => {
		const entries = Array.isArray(data)
			? data.map((b) => [
					b.label,
					{
						main: b.main,
						upStats: b.upStats,
						downStats: b.downStats,
						children: b.children,
					},
				])
			: Object.entries(data);
		if (entries.length === 0) return null;
		return (
			<Card
				className={`bg-zinc-900 border-zinc-800 ${colSpan ? 'lg:col-span-2' : ''}`}
			>
				<CardHeader>
					<CardTitle className="text-lg">{title}</CardTitle>
					<CardDescription>{description}</CardDescription>
				</CardHeader>
				<CardContent>
					<Accordion type="multiple" className="w-full">
						{entries.map(([label, group]: any) => (
							<AccordionItem
								value={label}
								key={label}
								className="border-b-0"
							>
								<AccordionTrigger className="py-0 hover:no-underline [&[data-state=open]>div]:bg-zinc-800/30">
									<div className="flex-1 text-left">
										{renderStatRow(
											label,
											group.main,
											false,
										)}
									</div>
								</AccordionTrigger>
								<AccordionContent className="pt-1 pb-3 px-4 bg-zinc-950/30 rounded-b-md mt-1 mb-2 border border-t-0 border-zinc-800/50">
									<div className="space-y-1">
										{renderDirectionRows(group)}
										{group.children &&
											group.children.length > 0 && (
												<Accordion
													type="multiple"
													className="w-full"
												>
													{group.children.map(
														(child: any) => (
															<AccordionItem
																value={
																	child.label
																}
																key={
																	child.label
																}
																className="border-b-0"
															>
																<AccordionTrigger className="py-0 hover:no-underline [&[data-state=open]>div]:bg-zinc-800/30">
																	<div className="flex-1 text-left">
																		{renderStatRow(
																			child.label,
																			child.stats,
																			true,
																		)}
																	</div>
																</AccordionTrigger>
																<AccordionContent className="pt-1 pb-3 px-4 bg-zinc-950/30 rounded-b-md mt-1 mb-2 border border-t-0 border-zinc-800/50">
																	<div className="space-y-1">
																		{renderDirectionRows(
																			child,
																		)}
																	</div>
																</AccordionContent>
															</AccordionItem>
														),
													)}
												</Accordion>
											)}
									</div>
								</AccordionContent>
							</AccordionItem>
						))}
					</Accordion>
				</CardContent>
			</Card>
		);
	};

	return (
		<div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6 pb-24">
			<div>
				<h2 className="text-xl sm:text-2xl font-bold tracking-tight">
					Trade Analysis
				</h2>
				<p className="text-sm sm:text-base text-zinc-400">
					Historical performance breakdown across{' '}
					<span className="text-zinc-100 font-bold">
						{analysis.total.total}
					</span>{' '}
					resolved trades.
				</p>
			</div>

			<div className="bg-linear-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/20 rounded-lg p-5 mt-4">
				<div className="flex items-center gap-2 mb-3">
					<Sparkles className="h-5 w-5 text-indigo-400" />
					<h3 className="font-semibold text-indigo-400 tracking-wide text-sm uppercase">
						AI Insights & Suggestions
					</h3>
				</div>
				<ul className="space-y-2">
					{suggestions.map((suggestion, idx) => (
						<li
							key={idx}
							className="flex gap-3 text-sm text-indigo-100/80 items-start"
						>
							<Lightbulb className="h-4 w-4 shrink-0 mt-0.5 text-yellow-500/80" />
							<span className="leading-snug">{suggestion}</span>
						</li>
					))}
				</ul>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Confidence Card */}
				<Card className="bg-zinc-900 border-zinc-800">
					<CardHeader>
						<CardTitle className="text-lg">
							Win Rate by Confidence
						</CardTitle>
						<CardDescription>
							Compared against 70% Config Threshold
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Accordion type="multiple" className="w-full">
							{Object.entries(analysis.confidence).map(
								([label, group]) => (
									<AccordionItem
										value={label}
										key={label}
										className="border-b-0"
									>
										<AccordionTrigger className="py-0 hover:no-underline [&[data-state=open]>div]:bg-zinc-800/30">
											<div className="flex-1 text-left">
												{renderStatRow(
													label,
													group.main,
													false,
												)}
											</div>
										</AccordionTrigger>
										<AccordionContent className="pt-1 pb-3 px-4 bg-zinc-950/30 rounded-b-md mt-1 mb-2 border border-t-0 border-zinc-800/50">
											<div className="space-y-1">
												{renderDirectionRows(group)}
												{group.children.length === 0 ? (
													<div className="text-zinc-600 text-xs py-2 italic text-center">
														No trades in this range
													</div>
												) : (
													<Accordion
														type="multiple"
														className="w-full"
													>
														{group.children.map(
															(child) => (
																<AccordionItem
																	value={
																		child.label
																	}
																	key={
																		child.label
																	}
																	className="border-b-0"
																>
																	<AccordionTrigger className="py-0 hover:no-underline [&[data-state=open]>div]:bg-zinc-800/30">
																		<div className="flex-1 text-left">
																			{renderStatRow(
																				child.label,
																				child.stats,
																				true,
																			)}
																		</div>
																	</AccordionTrigger>
																	<AccordionContent className="pt-1 pb-3 px-4 bg-zinc-950/30 rounded-b-md mt-1 mb-2 border border-t-0 border-zinc-800/50">
																		<div className="space-y-1">
																			{renderDirectionRows(
																				child,
																			)}
																		</div>
																	</AccordionContent>
																</AccordionItem>
															),
														)}
													</Accordion>
												)}
											</div>
										</AccordionContent>
									</AccordionItem>
								),
							)}
						</Accordion>
					</CardContent>
				</Card>

				{/* Price Card */}
				<Card className="bg-zinc-900 border-zinc-800">
					<CardHeader>
						<CardTitle className="text-lg">
							Win Rate by Entry Price
						</CardTitle>
						<CardDescription>
							Compared against 0.80 Config Max Target
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Accordion type="multiple" className="w-full">
							{Object.entries(analysis.price).map(
								([label, group]) => (
									<AccordionItem
										value={label}
										key={label}
										className="border-b-0"
									>
										<AccordionTrigger className="py-0 hover:no-underline [&[data-state=open]>div]:bg-zinc-800/30">
											<div className="flex-1 text-left">
												{renderStatRow(
													label,
													group.main,
													false,
												)}
											</div>
										</AccordionTrigger>
										<AccordionContent className="pt-1 pb-3 px-4 bg-zinc-950/30 rounded-b-md mt-1 mb-2 border border-t-0 border-zinc-800/50">
											<div className="space-y-1">
												{renderDirectionRows(group)}
												{group.children.length === 0 ? (
													<div className="text-zinc-600 text-xs py-2 italic text-center">
														No trades in this range
													</div>
												) : (
													<Accordion
														type="multiple"
														className="w-full"
													>
														{group.children.map(
															(child) => (
																<AccordionItem
																	value={
																		child.label
																	}
																	key={
																		child.label
																	}
																	className="border-b-0"
																>
																	<AccordionTrigger className="py-0 hover:no-underline [&[data-state=open]>div]:bg-zinc-800/30">
																		<div className="flex-1 text-left">
																			{renderStatRow(
																				child.label,
																				child.stats,
																				true,
																			)}
																		</div>
																	</AccordionTrigger>
																	<AccordionContent className="pt-1 pb-3 px-4 bg-zinc-950/30 rounded-b-md mt-1 mb-2 border border-t-0 border-zinc-800/50">
																		<div className="space-y-1">
																			{renderDirectionRows(
																				child,
																			)}
																		</div>
																	</AccordionContent>
																</AccordionItem>
															),
														)}
													</Accordion>
												)}
											</div>
										</AccordionContent>
									</AccordionItem>
								),
							)}
						</Accordion>
					</CardContent>
				</Card>

				{/* Direction Card */}
				<Card className="bg-zinc-900 border-zinc-800">
					<CardHeader>
						<CardTitle className="text-lg">
							Win Rate by Direction
						</CardTitle>
						<CardDescription>
							Performance based on UP vs DOWN
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Accordion type="multiple" className="w-full">
							{Object.entries(analysis.direction).map(
								([label, group]) => (
									<AccordionItem
										value={label}
										key={label}
										className="border-b-0"
									>
										<AccordionTrigger className="py-0 hover:no-underline [&[data-state=open]>div]:bg-zinc-800/30">
											<div className="flex-1 text-left">
												{renderStatRow(
													label,
													group.main,
													false,
												)}
											</div>
										</AccordionTrigger>
									</AccordionItem>
								),
							)}
						</Accordion>
					</CardContent>
				</Card>

				{/* Market Age Card */}
				<Card className="bg-zinc-900 border-zinc-800">
					<CardHeader>
						<CardTitle className="text-lg">
							Win Rate by Market Age
						</CardTitle>
						<CardDescription>
							Performance segment by entry time within the 5m
							window
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Accordion type="multiple" className="w-full">
							{Object.entries(analysis.marketAge).map(
								([label, group]) => (
									<AccordionItem
										value={label}
										key={label}
										className="border-b-0"
									>
										<AccordionTrigger className="py-0 hover:no-underline [&[data-state=open]>div]:bg-zinc-800/30">
											<div className="flex-1 text-left">
												{renderStatRow(
													label,
													group.main,
													false,
												)}
											</div>
										</AccordionTrigger>
										<AccordionContent className="pt-1 pb-3 px-4 bg-zinc-950/30 rounded-b-md mt-1 mb-2 border border-t-0 border-zinc-800/50">
											<div className="space-y-1">
												{group.children.length === 0 ? (
													<div className="text-zinc-600 text-xs py-2 italic text-center">
														No trades in this range
													</div>
												) : (
													group.children.map(
														(child) =>
															renderStatRow(
																child.label,
																child.stats,
																true,
															),
													)
												)}
											</div>
										</AccordionContent>
									</AccordionItem>
								),
							)}
						</Accordion>
					</CardContent>
				</Card>

				{/* Individual Indicator Cards */}
			</div>

			<h3 className="text-lg font-semibold text-zinc-200 mt-2">
				Technical Indicators
			</h3>
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* StochRSI Card */}
				<Card className="bg-zinc-900 border-zinc-800">
					<CardHeader>
						<CardTitle className="text-lg">
							Win Rate by Technicals: StochRSI
						</CardTitle>
						<CardDescription>
							Performance in Overbought ({'>80'}) vs Oversold{' '}
							{'(<20)'} conditions
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Accordion type="multiple" className="w-full">
							{Object.entries(analysis.stochRSI).map(
								([label, group]) => (
									<AccordionItem
										value={label}
										key={label}
										className="border-b-0"
									>
										<AccordionTrigger className="py-0 hover:no-underline [&[data-state=open]>div]:bg-zinc-800/30">
											<div className="flex-1 text-left">
												{renderStatRow(
													label,
													group.main,
													false,
												)}
											</div>
										</AccordionTrigger>
										<AccordionContent className="pt-1 pb-3 px-4 bg-zinc-950/30 rounded-b-md mt-1 mb-2 border border-t-0 border-zinc-800/50">
											<div className="space-y-1">
												{renderDirectionRows(group)}
												{group.children.length === 0 ? (
													<div className="text-zinc-600 text-xs py-2 italic text-center">
														No trades in this range
													</div>
												) : (
													<Accordion
														type="multiple"
														className="w-full"
													>
														{group.children.map(
															(child) => (
																<AccordionItem
																	value={
																		child.label
																	}
																	key={
																		child.label
																	}
																	className="border-b-0"
																>
																	<AccordionTrigger className="py-0 hover:no-underline [&[data-state=open]>div]:bg-zinc-800/30">
																		<div className="flex-1 text-left">
																			{renderStatRow(
																				child.label,
																				child.stats,
																				true,
																			)}
																		</div>
																	</AccordionTrigger>
																	<AccordionContent className="pt-1 pb-3 px-4 bg-zinc-950/30 rounded-b-md mt-1 mb-2 border border-t-0 border-zinc-800/50">
																		<div className="space-y-1">
																			{renderDirectionRows(
																				child,
																			)}
																		</div>
																	</AccordionContent>
																</AccordionItem>
															),
														)}
													</Accordion>
												)}
											</div>
										</AccordionContent>
									</AccordionItem>
								),
							)}
						</Accordion>
					</CardContent>
				</Card>

				{/* VWAP Card */}
				<Card className="bg-zinc-900 border-zinc-800">
					<CardHeader>
						<CardTitle className="text-lg">
							Win Rate by Technicals: VWAP
						</CardTitle>
						<CardDescription>
							Performance when Price is Above vs Below Volume
							Weighted Average Price
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{/* Above vs Below VWAP Summary */}
						<div className="grid grid-cols-2 gap-3">
							<div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
								<div className="text-xs text-emerald-400 font-medium mb-1">
									Above VWAP (Bullish)
								</div>
								<div className="text-lg font-bold text-zinc-100">
									{analysis.vwapSentiment.above.winRate.toFixed(
										1,
									)}
									%
								</div>
								<div className="text-xs text-zinc-400">
									{analysis.vwapSentiment.above.total} trades
									&middot;{' '}
									<span
										className={
											analysis.vwapSentiment.above
												.totalPnl >= 0
												? 'text-emerald-400'
												: 'text-red-400'
										}
									>
										{analysis.vwapSentiment.above
											.totalPnl >= 0
											? '+'
											: ''}
										$
										{analysis.vwapSentiment.above.totalPnl.toFixed(
											2,
										)}
									</span>
								</div>
								<div className="text-xs text-zinc-500 mt-1">
									Avg dist: +
									{analysis.vwapSentiment.avgDistAbove.toFixed(
										3,
									)}
									%
								</div>
							</div>
							<div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
								<div className="text-xs text-red-400 font-medium mb-1">
									Below VWAP (Bearish)
								</div>
								<div className="text-lg font-bold text-zinc-100">
									{analysis.vwapSentiment.below.winRate.toFixed(
										1,
									)}
									%
								</div>
								<div className="text-xs text-zinc-400">
									{analysis.vwapSentiment.below.total} trades
									&middot;{' '}
									<span
										className={
											analysis.vwapSentiment.below
												.totalPnl >= 0
												? 'text-emerald-400'
												: 'text-red-400'
										}
									>
										{analysis.vwapSentiment.below
											.totalPnl >= 0
											? '+'
											: ''}
										$
										{analysis.vwapSentiment.below.totalPnl.toFixed(
											2,
										)}
									</span>
								</div>
								<div className="text-xs text-zinc-500 mt-1">
									Avg dist:{' '}
									{analysis.vwapSentiment.avgDistBelow.toFixed(
										3,
									)}
									%
								</div>
							</div>
						</div>

						{/* Detailed VWAP Distance Buckets */}
						<Accordion type="multiple" className="w-full">
							{Object.entries(analysis.vwap).map(
								([label, group]) => (
									<AccordionItem
										value={label}
										key={label}
										className="border-b-0"
									>
										<AccordionTrigger className="py-0 hover:no-underline [&[data-state=open]>div]:bg-zinc-800/30">
											<div className="flex-1 text-left">
												{renderStatRow(
													label,
													group.main,
													false,
												)}
											</div>
										</AccordionTrigger>
										<AccordionContent className="pt-1 pb-3 px-4 bg-zinc-950/30 rounded-b-md mt-1 mb-2 border border-t-0 border-zinc-800/50">
											<div className="space-y-1">
												{renderDirectionRows(group)}
												{group.children.length === 0 ? (
													<div className="text-zinc-600 text-xs py-2 italic text-center">
														No trades in this range
													</div>
												) : (
													<Accordion
														type="multiple"
														className="w-full"
													>
														{group.children.map(
															(child) => (
																<AccordionItem
																	value={
																		child.label
																	}
																	key={
																		child.label
																	}
																	className="border-b-0"
																>
																	<AccordionTrigger className="py-0 hover:no-underline [&[data-state=open]>div]:bg-zinc-800/30">
																		<div className="flex-1 text-left">
																			{renderStatRow(
																				child.label,
																				child.stats,
																				true,
																			)}
																		</div>
																	</AccordionTrigger>
																	<AccordionContent className="pt-1 pb-3 px-4 bg-zinc-950/30 rounded-b-md mt-1 mb-2 border border-t-0 border-zinc-800/50">
																		<div className="space-y-1">
																			{renderDirectionRows(
																				child,
																			)}
																		</div>
																	</AccordionContent>
																</AccordionItem>
															),
														)}
													</Accordion>
												)}
											</div>
										</AccordionContent>
									</AccordionItem>
								),
							)}
						</Accordion>
					</CardContent>
				</Card>

				{renderAccordionCard(
					'Win Rate by Micro RSI',
					'Short-term RSI momentum (0-100)',
					analysis.microRsi,
				)}
				{renderAccordionCard(
					'Win Rate by RSI-14',
					'Standard 14-period RSI. Overbought (>70) vs Oversold (<30)',
					analysis.rsi14,
				)}
				{renderAccordionCard(
					'Win Rate by EMA-3 Distance',
					'% distance of BTC price from 3-period EMA',
					analysis.ema3Dist,
				)}
				{renderAccordionCard(
					'Win Rate by EMA-8 Distance',
					'% distance of BTC price from 8-period EMA',
					analysis.ema8Dist,
				)}
				{renderAccordionCard(
					'Win Rate by Bollinger Band Position',
					'Price position within BB range (0%=lower, 100%=upper)',
					analysis.bbPosition,
				)}
				{renderAccordionCard(
					'Win Rate by Momentum (3-bar)',
					'3-bar price momentum percentage',
					analysis.momentum3,
				)}
				{renderAccordionCard(
					'Win Rate by Volatility',
					'Market volatility at trade entry',
					analysis.volatility,
				)}
			</div>

			<h3 className="text-lg font-semibold text-zinc-200 mt-2">
				Date & Time
			</h3>
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{renderAccordionCard(
					'Win Rate by Time of Day (Hour)',
					'Performance segmented by the hour the trade was executed',
					analysis.timeOfDay,
					true,
				)}
				{renderAccordionCard(
					'Win Rate by Day of Week',
					'Performance by day, expandable by hour',
					analysis.dayOfWeek,
					true,
				)}
				{/* By Date Card with Goal */}
				<Card className="bg-zinc-900 border-zinc-800 lg:col-span-2">
					<CardHeader>
						<CardTitle className="text-lg">
							Win Rate by Date
						</CardTitle>
						<CardDescription>
							Daily performance breakdown — goal: $
							{dayPnlGoal.toFixed(2)}/day
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Accordion type="multiple" className="w-full">
							{analysis.byDate.map((entry) => {
								const goalPct =
									dayPnlGoal > 0
										? Math.min(
												100,
												(entry.main.totalPnl /
													dayPnlGoal) *
													100,
											)
										: 0;
								return (
									<AccordionItem
										value={entry.label}
										key={entry.label}
										className="border-b-0"
									>
										<AccordionTrigger className="py-0 hover:no-underline [&[data-state=open]>div]:bg-zinc-800/30">
											<div className="flex-1 text-left">
												<div className="flex flex-wrap sm:flex-nowrap items-center justify-between py-2 border-b border-zinc-800/50 last:border-0 rounded -mx-2 px-2 gap-1 hover:bg-zinc-800/30">
													<span className="text-zinc-300 font-medium w-full sm:w-[25%] pl-2 truncate">
														{entry.label}
													</span>
													<span className="text-zinc-500 text-xs font-mono w-auto sm:w-[15%] text-center">
														{entry.main.total}{' '}
														trades
													</span>
													<span
														className={`font-mono font-medium text-xs w-auto sm:w-[15%] text-center ${entry.main.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
													>
														{entry.main.totalPnl >=
														0
															? '+'
															: ''}
														$
														{entry.main.totalPnl.toFixed(
															2,
														)}
													</span>
													<div className="w-auto sm:w-[20%] flex items-center gap-1.5">
														<div className="flex-1 bg-zinc-800 rounded-full h-1.5">
															<div
																className={`h-1.5 rounded-full ${
																	entry.main
																		.totalPnl >=
																	dayPnlGoal
																		? 'bg-emerald-400'
																		: entry
																					.main
																					.totalPnl >=
																			  0
																			? 'bg-amber-400'
																			: 'bg-red-400'
																}`}
																style={{
																	width: `${Math.max(0, goalPct)}%`,
																}}
															/>
														</div>
														<span className="text-zinc-600 text-[10px] font-mono whitespace-nowrap">
															{goalPct.toFixed(0)}
															%
														</span>
													</div>
													<div className="w-auto sm:w-[25%] text-right whitespace-nowrap">
														<span
															className={`font-mono font-bold ${entry.main.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}
														>
															{entry.main.winRate.toFixed(
																1,
															)}
															%
														</span>
														<span className="text-zinc-600 text-xs ml-1">
															({entry.main.wins}W/
															{entry.main.losses}
															L)
														</span>
													</div>
												</div>
											</div>
										</AccordionTrigger>
										<AccordionContent className="pt-1 pb-3 px-4 bg-zinc-950/30 rounded-b-md mt-1 mb-2 border border-t-0 border-zinc-800/50">
											<div className="space-y-1">
												{renderDirectionRows(entry)}
											</div>
										</AccordionContent>
									</AccordionItem>
								);
							})}
						</Accordion>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
