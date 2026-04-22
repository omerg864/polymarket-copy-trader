import { useState } from 'react';
import {
	useAvailableSimulations,
	useRunSimulation,
	useConfig,
} from '@/hooks/use-api';
import { SimulationType, TradeType } from '@shared/types';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from './ui/card';
import { Button } from './ui/button';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from './ui/select';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from './ui/table';
import { Play, TrendingUp, AlertCircle, Plus, Trash2, Clock } from 'lucide-react';

export function Simulations() {
	const { data: available, isLoading: loadingAvailable } =
		useAvailableSimulations();
	const { data: config } = useConfig();
	const {
		mutate: runSim,
		isPending,
		data: result,
		error,
	} = useRunSimulation();

	const [selectedId, setSelectedId] = useState<string>('');
	const [params, setParams] = useState<Record<string, any>>({});
	const [newWindow, setNewWindow] = useState({ start: '', end: '' });

	const handleSelectSim = (id: string) => {
		setSelectedId(id);
		const sim = available?.find((s) => s.id === id);
		const newParams: Record<string, any> = {};

		if (sim?.params) {
			sim.params.forEach((p: any) => {
				newParams[p.name] = p.default;
				// Pre-fill from config if matching name exists (e.g. excludedTimeWindows)
				if (config && (config as any)[p.name] !== undefined) {
					newParams[p.name] = (config as any)[p.name];
				}
			});
		}
		setParams(newParams);
	};

	const selectedSim = available?.find((s) => s.id === selectedId);

	const handleRun = () => {
		if (!selectedId || !config) return;
		runSim({
			type: selectedId as SimulationType,
			mode:
				config.mode === TradeType.LIVE
					? TradeType.LIVE
					: TradeType.DEMO,
			params,
		});
	};

	const handleParamChange = (name: string, value: any) => {
		setParams((prev) => ({ ...prev, [name]: value }));
	};

	const handleAddWindow = (name: string) => {
		if (newWindow.start && newWindow.end) {
			const current = params[name] || [];
			handleParamChange(name, [...current, newWindow]);
			setNewWindow({ start: '', end: '' });
		}
	};

	const handleRemoveWindow = (name: string, index: number) => {
		const current = params[name] || [];
		handleParamChange(
			name,
			current.filter((_: any, i: number) => i !== index),
		);
	};

	if (loadingAvailable) {
		return (
			<div className="text-zinc-500 animate-pulse">
				Loading simulations...
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				{/* Configuration Card */}
				<Card className="md:col-span-1 bg-zinc-900 border-zinc-800">
					<CardHeader>
						<CardTitle className="text-zinc-100 flex items-center gap-2">
							<Play className="w-5 h-5 text-indigo-400" />
							Run Simulation
						</CardTitle>
						<CardDescription className="text-zinc-400">
							Configure and start a historical simulation for the
							current mode.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="sim-type" className="text-zinc-400">
								Simulation Type
							</Label>
							<Select
								onValueChange={handleSelectSim}
								value={selectedId}
							>
								<SelectTrigger className="bg-zinc-950 border-zinc-800 text-zinc-200">
									<SelectValue placeholder="Select simulation..." />
								</SelectTrigger>
								<SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
									{available?.map((sim) => (
										<SelectItem key={sim.id} value={sim.id}>
											{sim.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{selectedSim && (
								<p className="text-xs text-zinc-500 mt-1">
									{selectedSim.description}
								</p>
							)}
						</div>

						{selectedSim?.params?.map((p: any) => (
							<div key={p.name} className="space-y-4">
								<Label
									htmlFor={p.name}
									className="text-zinc-400"
								>
									{p.label}
								</Label>

								{p.type === 'windows' ? (
									<div className="space-y-3">
										<div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
											{(params[p.name] || []).length >
											0 ? (
												(params[p.name] || []).map(
													(w: any, i: number) => (
														<div
															key={i}
															className="flex items-center justify-between p-2 bg-zinc-950 border border-zinc-800 rounded-lg"
														>
															<div className="flex items-center gap-2 text-zinc-300 text-xs font-mono">
																<Clock className="w-3 h-3 text-zinc-500" />
																{w.start} —{' '}
																{w.end}
															</div>
															<Button
																variant="ghost"
																size="icon"
																className="h-6 w-6 text-red-500 hover:text-red-400 hover:bg-red-500/10"
																onClick={() =>
																	handleRemoveWindow(
																		p.name,
																		i,
																	)
																}
															>
																<Trash2 className="h-3.5 w-3.5" />
															</Button>
														</div>
													),
												)
											) : (
												<div className="text-zinc-600 italic text-xs py-2">
													No windows defined
												</div>
											)}
										</div>

										<div className="pt-2 border-t border-zinc-800 flex items-end gap-2">
											<div className="grid grid-cols-2 gap-2 flex-grow">
												<div className="space-y-1">
													<label className="text-[10px] text-zinc-500 uppercase">
														Start
													</label>
													<Input
														type="time"
														value={newWindow.start}
														onChange={(e) =>
															setNewWindow({
																...newWindow,
																start: e.target
																	.value,
															})
														}
														className="h-8 bg-zinc-950 border-zinc-800 text-xs text-zinc-200 px-2"
													/>
												</div>
												<div className="space-y-1">
													<label className="text-[10px] text-zinc-500 uppercase">
														End
													</label>
													<Input
														type="time"
														value={newWindow.end}
														onChange={(e) =>
															setNewWindow({
																...newWindow,
																end: e.target
																	.value,
															})
														}
														className="h-8 bg-zinc-950 border-zinc-800 text-xs text-zinc-200 px-2"
													/>
												</div>
											</div>
											<Button
												size="icon"
												className="h-8 w-8 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 shrink-0"
												onClick={() =>
													handleAddWindow(p.name)
												}
												disabled={
													!newWindow.start ||
													!newWindow.end
												}
											>
												<Plus className="h-4 w-4" />
											</Button>
										</div>
									</div>
								) : (
									<Input
										type={p.type}
										id={p.name}
										className="bg-zinc-950 border-zinc-800 text-zinc-200"
										value={params[p.name] ?? p.default}
										onChange={(e) =>
											handleParamChange(
												p.name,
												p.type === 'number'
													? Number(e.target.value)
													: e.target.value,
											)
										}
									/>
								)}
							</div>
						))}

						<Button
							className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white border-0"
							onClick={handleRun}
							disabled={!selectedId || isPending}
						>
							{isPending ? 'Running...' : 'Run Simulation'}
						</Button>

						{error && (
							<div className="p-3 bg-red-950/30 border border-red-900 rounded-lg flex gap-2 items-start mt-4">
								<AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
								<p className="text-xs text-red-400">
									{(error as Error).message}
								</p>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Overall Results Card */}
				{result && (
					<Card className="md:col-span-2 bg-zinc-900 border-zinc-800">
						<CardHeader>
							<CardTitle className="text-zinc-100 flex items-center gap-2">
								<TrendingUp className="w-5 h-5 text-emerald-400" />
								Overall Results
							</CardTitle>
							<CardDescription className="text-zinc-400">
								Comparison between actual and simulated
								performance.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
								<div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-1">
									<p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
										Total PnL
									</p>
									<div className="flex flex-col">
										<span className="text-lg font-bold text-zinc-100">
											$
											{result.overall.totalSimPnL.toFixed(
												2,
											)}
										</span>
										<span
											className={`text-xs ${result.overall.impact >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
										>
											{result.overall.impact >= 0
												? '+'
												: ''}
											${result.overall.impact.toFixed(2)}{' '}
											vs Act
										</span>
									</div>
								</div>
								<div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-1">
									<p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
										Win Rate
									</p>
									<div className="flex flex-col">
										<span className="text-lg font-bold text-zinc-100">
											{result.overall.simWR.toFixed(1)}%
										</span>
										<span className="text-xs text-zinc-400">
											Actual:{' '}
											{result.overall.actWR.toFixed(1)}%
										</span>
									</div>
								</div>
								<div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-1">
									<p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
										Trades
									</p>
									<div className="flex flex-col">
										<span className="text-lg font-bold text-zinc-100">
											{result.overall.totalSimTrades}
										</span>
										<span className="text-xs text-zinc-400">
											Out of{' '}
											{result.overall.totalActTrades}
										</span>
									</div>
								</div>
								<div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-1">
									<p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
										Avg Daily PnL
									</p>
									<div className="flex flex-col">
										<span className="text-lg font-bold text-zinc-100">
											$
											{result.overall.avgDailySimPnL.toFixed(
												2,
											)}
										</span>
										<span className="text-xs text-zinc-400">
											Actual: $
											{result.overall.avgDailyActPnL.toFixed(
												2,
											)}
										</span>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				)}
			</div>

			{/* Daily Breakdown Table */}
			{result && (
				<Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
					<CardHeader className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-4">
						<CardTitle className="text-lg text-zinc-100">
							Daily Breakdown
						</CardTitle>
					</CardHeader>
					<div className="overflow-x-auto">
						<Table>
							<TableHeader className="bg-zinc-950">
								<TableRow className="border-zinc-800 hover:bg-zinc-950">
									<TableHead className="text-zinc-500 font-bold uppercase text-[10px] tracking-wider px-6">
										Date
									</TableHead>
									<TableHead className="text-right text-zinc-500 font-bold uppercase text-[10px] tracking-wider px-6">
										Actual PnL
									</TableHead>
									<TableHead className="text-right text-zinc-500 font-bold uppercase text-[10px] tracking-wider px-6">
										Sim PnL
									</TableHead>
									<TableHead className="text-right text-zinc-500 font-bold uppercase text-[10px] tracking-wider px-6">
										Act WR%
									</TableHead>
									<TableHead className="text-right text-zinc-500 font-bold uppercase text-[10px] tracking-wider px-6">
										Sim WR%
									</TableHead>
									<TableHead className="text-right text-zinc-500 font-bold uppercase text-[10px] tracking-wider px-6">
										Trades(A/S)
									</TableHead>
									{result.type ===
										SimulationType.DAILY_TP && (
										<TableHead className="text-center text-zinc-500 font-bold uppercase text-[10px] tracking-wider px-6">
											TP Hit?
										</TableHead>
									)}
								</TableRow>
							</TableHeader>
							<TableBody>
								{result.daily.map((day) => (
									<TableRow
										key={day.date}
										className="border-zinc-800 hover:bg-zinc-800/30 transition-colors"
									>
										<TableCell className="font-mono text-zinc-300 px-6">
											{day.date}
										</TableCell>
										<TableCell
											className={`text-right font-mono px-6 ${day.actPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
										>
											${day.actPnL.toFixed(2)}
										</TableCell>
										<TableCell
											className={`text-right font-mono px-6 ${day.simPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
										>
											${day.simPnL.toFixed(2)}
										</TableCell>
										<TableCell className="text-right text-zinc-500 font-mono px-6">
											{(day.actTrades > 0
												? (day.actWins /
														day.actTrades) *
													100
												: 0
											).toFixed(1)}
											%
										</TableCell>
										<TableCell className="text-right text-zinc-100 font-mono px-6">
											{(day.simTrades > 0
												? (day.simWins /
														day.simTrades) *
													100
												: 0
											).toFixed(1)}
											%
										</TableCell>
										<TableCell className="text-right text-zinc-600 text-xs px-6">
											{day.actTrades} / {day.simTrades}
										</TableCell>
										{result.type ===
											SimulationType.DAILY_TP && (
											<TableCell className="text-center px-6">
												{day.tpHit ? (
													<Badge
														variant="outline"
														className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-2 py-0 text-[10px]"
													>
														YES
													</Badge>
												) : (
													<Badge
														variant="outline"
														className="text-zinc-600 border-zinc-800 px-2 py-0 text-[10px]"
													>
														No
													</Badge>
												)}
											</TableCell>
										)}
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				</Card>
			)}
		</div>
	);
}
