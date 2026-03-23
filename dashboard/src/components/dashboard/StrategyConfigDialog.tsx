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
import { Pencil } from 'lucide-react';
import { useCallback, useState } from 'react';
import { ConfigRow } from './ConfigRow';
import { ConfigSection } from './ConfigSection';

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
						<ConfigSection title="Strategy Guards">
							<ConfigRow
								label="Min Confidence"
								field="confidenceThreshold"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
								min={0}
							/>
							<ConfigRow
								label="Min Entry Price"
								field="minEntryPrice"
								prefix="$"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
								min={0}
							/>
							<ConfigRow
								label="Max Entry Price"
								field="maxEntryPrice"
								prefix="$"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
								min={0}
							/>
							<ConfigRow
								label="Min StochRSI"
								field="minStochRSI"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
								min={0}
							/>
							<ConfigRow
								label="Max StochRSI"
								field="maxStochRSI"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
								min={0}
							/>
							<ConfigRow
								label="Min RSI-14"
								field="minRSI14"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
								min={0}
							/>
							<ConfigRow
								label="Max RSI-14"
								field="maxRSI14"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
								min={0}
							/>
							<ConfigRow
								label="Min BB Position"
								field="minBBPosition"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
								min={0}
							/>
							<ConfigRow
								label="Max BB Position"
								field="maxBBPosition"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
								min={0}
							/>
							<ConfigRow
								label="Min Market Age"
								field="minMarketAgeMinutes"
								suffix=" min"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
								min={0}
							/>
							<ConfigRow
								label="Take Profit"
								field="takeProfitPct"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
								min={0}
							/>
							<ConfigRow
								label="Market Price Stop Loss"
								field="marketPriceStopLoss"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
								min={0}
							/>
							<ConfigRow
								label="Force Close Before End"
								field="maxSecLoseFct"
								suffix="s"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
								min={0}
							/>
							<ConfigRow
								label="Min Seconds Remaining"
								field="minSecondsRemaining"
								suffix="s"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
								min={0}
							/>
							<ConfigRow
								label="BTC Price Guard Offset"
								field="btcPriceOffset"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
							/>
							<ConfigRow
								label="FCT BTC Offset"
								field="fctBtcOffset"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
								min={0}
							/>
						</ConfigSection>
						<ConfigSection title="Technical Analysis">
							<ConfigRow
								label="Candles Fetched"
								field="candleCount"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
								min={1}
							/>
							<ConfigRow
								label="RSI Period"
								field="rsiPeriod"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
								min={1}
							/>
							<ConfigRow
								label="EMA Fast"
								field="emaFast"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
								min={1}
							/>
							<ConfigRow
								label="EMA Slow"
								field="emaSlow"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
								min={1}
							/>
						</ConfigSection>
						<ConfigSection title="Advanced">
							<ConfigRow
								label="Risk Monitor Interval"
								field="riskMonitorIntervalMs"
								suffix=" ms"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
								min={100}
							/>
							<ConfigRow
								label="High Price Threshold"
								field="highPriceThreshold"
								prefix="$"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
								min={0}
							/>
							<ConfigRow
								label="High Price Bonus"
								field="highPriceMaxBonusPct"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
								min={0}
							/>
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
