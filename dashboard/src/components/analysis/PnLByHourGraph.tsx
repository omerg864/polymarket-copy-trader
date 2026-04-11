import React from 'react';
import {
	LineChart,
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
	Legend,
	ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import { formatBtcPrice } from '@/lib/utils';

interface PnLByHourGraphProps {
	data: any[];
	dates: string[];
	dayPnlGoal?: number;
	className?: string;
}

const COLORS = [
	'#6366f1', // Indigo
	'#ec4899', // Pink
	'#8b5cf6', // Violet
	'#06b6d4', // Cyan
	'#10b981', // Emerald
	'#f59e0b', // Amber
	'#ef4444', // Red
	'#3b82f6', // Blue
	'#84cc16', // Lime
	'#f97316', // Orange
	'#a855f7', // Purple
	'#0ea5e9', // Sky
	'#14b8a6', // Teal
	'#d946ef', // Fuchsia
	'#2dd4bf', // Aquamarine
	'#fb7185', // Rose
	'#c084fc', // Bright Purple
	'#4ade80', // Light Green
	'#fb923c', // Light Orange
	'#38bdf8', // Light Sky
];

export const PnLByHourGraph: React.FC<PnLByHourGraphProps> = ({
	data,
	dates,
	dayPnlGoal,
	className,
}) => {
	return (
		<Card
			className={`bg-zinc-900 border-zinc-800 shadow-2xl relative overflow-hidden group ${className}`}
		>
			<CardHeader className="pb-2">
				<div className="flex justify-between items-center">
					<div className="space-y-1">
						<CardTitle className="text-xl font-bold flex items-center gap-2 text-zinc-100">
							<BarChart3 className="h-5 w-5 text-indigo-400" />
							PnL by Hour (Daily Comparison)
						</CardTitle>
						<div className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
							Cumulative PnL progression by hour of the day
						</div>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<div className="h-[450px] w-full mt-4">
					<ResponsiveContainer width="100%" height="100%">
						<LineChart
							data={data}
							margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
						>
							<CartesianGrid
								strokeDasharray="3 3"
								stroke="rgba(39, 39, 42, 0.3)"
								vertical={false}
							/>
							<XAxis
								dataKey="hour"
								stroke="#71717a"
								fontSize={12}
								tickLine={false}
								axisLine={false}
								tickFormatter={(value) =>
									`${value.toString().padStart(2, '0')}:00`
								}
							/>
							<YAxis
								stroke="#71717a"
								fontSize={12}
								tickLine={false}
								axisLine={false}
								tickFormatter={(value) =>
									`$${value.toFixed(1)}`
								}
							/>
							<Tooltip
								contentStyle={{
									backgroundColor: '#18181b',
									borderColor: '#27272a',
									borderRadius: '8px',
									color: '#f4f4f5',
									border: '1px solid rgba(255,255,255,0.1)',
								}}
								itemStyle={{
									fontSize: '12px',
									padding: '2px 0',
								}}
								labelStyle={{
									fontWeight: 'bold',
									marginBottom: '4px',
									color: '#a1a1aa',
								}}
								labelFormatter={(hour) =>
									`Hour: ${hour.toString().padStart(2, '0')}:00`
								}
								formatter={(value: any, name: any) => {
									const val =
										typeof value === 'number' ? value : 0;
									return [
										<span
											className={
												val >= 0
													? 'text-emerald-400'
													: 'text-red-400'
											}
										>
											{val >= 0 ? '+' : ''}
											{formatBtcPrice(val)}
										</span>,
										name,
									];
								}}
							/>
							<Legend
								wrapperStyle={{ paddingTop: '20px' }}
								iconType="circle"
								formatter={(value) => (
									<span className="text-xs text-zinc-400 font-medium">
										{value}
									</span>
								)}
							/>

							{dayPnlGoal !== undefined && (
								<ReferenceLine
									y={dayPnlGoal}
									stroke="#fbbf24"
									strokeDasharray="5 5"
									label={{
										value: `Goal: $${dayPnlGoal}`,
										position: 'right',
										fill: '#fbbf24',
										fontSize: 10,
										fontWeight: 'bold',
									}}
								/>
							)}

							{dates.map((date, index) => (
								<Line
									key={date}
									type="monotone"
									dataKey={date}
									stroke={COLORS[index % COLORS.length]}
									strokeWidth={2}
									dot={false}
									activeDot={{
										r: 4,
										strokeWidth: 0,
										fill: COLORS[index % COLORS.length],
									}}
									opacity={0.7}
									animationDuration={1500}
								/>
							))}
						</LineChart>
					</ResponsiveContainer>
				</div>
			</CardContent>
		</Card>
	);
};
