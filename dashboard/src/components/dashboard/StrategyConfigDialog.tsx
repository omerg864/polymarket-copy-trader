import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { useTimezones, useUpdateConfig } from '@/hooks/use-api';
import type { StrategyConfig } from '@/types';
import { Pencil, Plus, Trash2, Clock, ExternalLink } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { ConfigRow } from './ConfigRow';
import { ConfigSection } from './ConfigSection';
import { Input } from '@/components/ui/input';

interface StrategyConfigDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	config: StrategyConfig | undefined;
	isAdmin: boolean;
	refetchConfig: () => void;
}

export function StrategyConfigDialog({
	open,
	onOpenChange,
	config,
	isAdmin,
	refetchConfig,
}: StrategyConfigDialogProps) {
	const updateConfig = useUpdateConfig();
	const { data: timezones } = useTimezones();
	const [editing, setEditing] = useState(false);
	const [editValues, setEditValues] = useState<Partial<StrategyConfig>>({});
	const [prevConfig, setPrevConfig] = useState(config);
	const [prevOpen, setPrevOpen] = useState(open);
	const [newWindow, setNewWindow] = useState({ start: '', end: '' });
	const [newWallet, setNewWallet] = useState({ address: '', nickname: '' });

	if (config !== prevConfig || open !== prevOpen) {
		setPrevConfig(config);
		setPrevOpen(open);
		if (open && config) {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { mode: _, ...strategy } = config;
			setEditValues(strategy);
			setEditing(false);
		}
	}

	const resetEditValues = useCallback(() => {
		if (config) {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { mode: _, ...strategy } = config;
			setEditValues(strategy);
		}
		setEditing(false);
	}, [config]);

	const handleAddWindow = () => {
		if (newWindow.start && newWindow.end) {
			const current = editValues.excludedTimeWindows || [];
			setEditValues({
				...editValues,
				excludedTimeWindows: [...current, newWindow],
			});
			setNewWindow({ start: '', end: '' });
		}
	};

	const handleRemoveWindow = (index: number) => {
		const current = editValues.excludedTimeWindows || [];
		setEditValues({
			...editValues,
			excludedTimeWindows: current.filter((_, i) => i !== index),
		});
	};

	const handleAddWallet = () => {
		if (newWallet.address && newWallet.nickname) {
			const current = editValues.wallets || [];
			setEditValues({
				...editValues,
				wallets: [...current, newWallet],
			});
			setNewWallet({ address: '', nickname: '' });
		}
	};

	const handleRemoveWallet = (index: number) => {
		const current = editValues.wallets || [];
		setEditValues({
			...editValues,
			wallets: current.filter((_, i) => i !== index),
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[425px] bg-zinc-950 border border-zinc-800 text-zinc-100">
				<DialogHeader>
					<DialogTitle className="text-xl flex items-center justify-between">
						Bot Configuration
						{isAdmin && !editing && (
							<Button
								variant="ghost"
								size="sm"
								className="h-7 px-2 text-zinc-400 hover:text-zinc-200"
								onClick={() => setEditing(true)}
							>
								<Pencil className="h-3.5 w-3.5 mr-1" />
								Edit
							</Button>
						)}
					</DialogTitle>
				</DialogHeader>
				{config ? (
					<div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
						<ConfigSection title="Copy Trading Wallets">
							{!editing ? (
								(config.wallets || []).length > 0 ? (
									(config.wallets || []).map((w, i) => (
										<React.Fragment key={i}>
											<div className="flex flex-col py-1">
												<span className="text-zinc-200 font-medium text-sm">
													{w.nickname}
												</span>
												<a
													href={`https://polymarket.com/profile/${w.address}`}
													target="_blank"
													rel="noopener noreferrer"
													className="text-[10px] text-blue-400 hover:underline flex items-center gap-1"
												>
													{w.address.slice(0, 6)}...
													{w.address.slice(-4)}
													<ExternalLink className="h-2 w-2" />
												</a>
											</div>
											<div />
										</React.Fragment>
									))
								) : (
									<div className="col-span-2 text-zinc-600 italic py-1 text-sm">
										No wallets configured
									</div>
								)
							) : (
								<>
									{(editValues.wallets || []).map((w, i) => (
										<React.Fragment key={i}>
											<div className="flex items-center gap-2 py-1">
												<Button
													variant="ghost"
													size="icon"
													className="h-6 w-6 text-red-500 hover:text-red-400 hover:bg-red-500/10"
													onClick={() =>
														handleRemoveWallet(i)
													}
												>
													<Trash2 className="h-3.5 w-3.5" />
												</Button>
												<div className="flex flex-col">
													<span className="text-xs text-zinc-300">
														{w.nickname}
													</span>
													<span className="text-[10px] text-zinc-500">
														{w.address.slice(0, 10)}
														...
													</span>
												</div>
											</div>
											<div />
										</React.Fragment>
									))}
									<div className="col-span-2 border-t border-zinc-800/50 mt-2 pt-3 flex flex-col gap-2">
										<div className="grid grid-cols-2 gap-2">
											<Input
												placeholder="Nickname"
												value={newWallet.nickname}
												onChange={(e) =>
													setNewWallet({
														...newWallet,
														nickname:
															e.target.value,
													})
												}
												className="h-8 bg-zinc-900 border-zinc-800 text-xs"
											/>
											<Input
												placeholder="Address"
												value={newWallet.address}
												onChange={(e) =>
													setNewWallet({
														...newWallet,
														address: e.target.value,
													})
												}
												className="h-8 bg-zinc-900 border-zinc-800 text-xs"
											/>
										</div>
										<Button
											size="sm"
											className="h-8 w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700"
											onClick={handleAddWallet}
											disabled={
												!newWallet.address ||
												!newWallet.nickname
											}
										>
											<Plus className="h-4 w-4 mr-2" />{' '}
											Add Wallet
										</Button>
									</div>
								</>
							)}
						</ConfigSection>

						<ConfigSection title="Trading Limits">
							<ConfigRow
								label="Fixed Order Size"
								field="fixedOrderSizeUsd"
								prefix="$"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
								min={0}
							/>
							<ConfigRow
								label="Max Open Trades"
								field="maxConcurrentTrades"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
								min={1}
							/>
							<ConfigRow
								label="Bot Allowance"
								field="botAllowance"
								prefix="$"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
								min={0}
							/>
							<ConfigRow
								label="Daily Take Profit"
								field="dailyTakeProfit"
								prefix="$"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
							/>
							<ConfigRow
								label="Daily Stop Loss"
								field="dailyStopLoss"
								prefix="$"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
							/>
							<ConfigRow
								label="Server Timezone"
								field="timezone"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
								type="select"
								options={timezones}
							/>
						</ConfigSection>

						<ConfigSection title="Time Exclusions">
							{!editing ? (
								(config.excludedTimeWindows || []).length >
								0 ? (
									(config.excludedTimeWindows || []).map(
										(w, i) => (
											<React.Fragment key={i}>
												<span className="text-zinc-500 flex items-center gap-2">
													<Clock className="h-3 w-3" />
													Window #{i + 1}
												</span>
												<span className="text-right text-zinc-300">
													{w.start} — {w.end}
												</span>
											</React.Fragment>
										),
									)
								) : (
									<div className="col-span-2 text-zinc-600 italic py-1 text-sm">
										No exclusion windows defined
									</div>
								)
							) : (
								<>
									{(
										editValues.excludedTimeWindows || []
									).map((w, i) => (
										<React.Fragment key={i}>
											<div className="flex items-center gap-2 py-1">
												<Button
													variant="ghost"
													size="icon"
													className="h-6 w-6 text-red-500 hover:text-red-400 hover:bg-red-500/10"
													onClick={() =>
														handleRemoveWindow(i)
													}
												>
													<Trash2 className="h-3.5 w-3.5" />
												</Button>
												<span className="text-zinc-400 text-xs">
													{w.start} — {w.end}
												</span>
											</div>
											<div />
										</React.Fragment>
									))}
									<div className="col-span-2 border-t border-zinc-800/50 mt-2 pt-3 flex flex-col gap-2">
										<div className="flex items-center gap-2">
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
														className="h-8 bg-zinc-900 border-zinc-800 text-xs"
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
														className="h-8 bg-zinc-900 border-zinc-800 text-xs"
													/>
												</div>
											</div>
											<Button
												size="icon"
												className="h-8 w-8 mt-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700"
												onClick={handleAddWindow}
												disabled={
													!newWindow.start ||
													!newWindow.end
												}
											>
												<Plus className="h-4 w-4" />
											</Button>
										</div>
									</div>
								</>
							)}
						</ConfigSection>

						<ConfigSection title="Advanced">
							<ConfigRow
								label="Cycle Interval"
								field="cycleIntervalMs"
								suffix=" ms"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
								min={500}
							/>
							<ConfigRow
								label="Day P&L Goal"
								field="dayPnlGoal"
								prefix="$"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
								min={1}
							/>
						</ConfigSection>
					</div>
				) : (
					<div className="py-8 text-center text-zinc-500 animate-pulse">
						Loading configuration...
					</div>
				)}
				{editing && (
					<DialogFooter className="gap-2 sm:gap-0">
						<Button
							variant="outline"
							className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
							onClick={() => {
								resetEditValues();
							}}
						>
							Cancel
						</Button>
						<Button
							className="bg-blue-600 hover:bg-blue-700 text-white"
							disabled={updateConfig.isPending}
							onClick={() => {
								updateConfig.mutate(editValues, {
									onSuccess: () => {
										setEditing(false);
										refetchConfig();
									},
								});
							}}
						>
							{updateConfig.isPending
								? '⌛ Saving...'
								: 'Save Changes'}
						</Button>
					</DialogFooter>
				)}
			</DialogContent>
		</Dialog>
	);
}
