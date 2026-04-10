import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
	Bell,
	Clock,
	Download,
	MoreVertical,
	Pause,
	Play,
	RotateCcw,
	Settings2,
	ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import type { StrategyConfig, Trade, TradeSummary } from '@/types';

interface ActionsDropdownProps {
	summary: TradeSummary | undefined;
	history: Trade[] | undefined;
	config: StrategyConfig | undefined;
	isReadonly: boolean;
	isAdmin: boolean;
	onToggleStop: (stopping: boolean) => void;
	onOpenAlerts: () => void;
	onOpenReset: () => void;
	onOpenConfig: () => void;
	onOpenStartTime: () => void;
	onOpenVerifyStats: () => void;
	onExport: () => void;
	isTogglePending: boolean;
	isResetPending: boolean;
}

export function ActionsDropdown({
	summary,
	history,
	config,
	isReadonly,
	isAdmin,
	onToggleStop,
	onOpenAlerts,
	onOpenReset,
	onOpenConfig,
	onOpenStartTime,
	onOpenVerifyStats,
	onExport,
	isTogglePending,
	isResetPending,
}: ActionsDropdownProps) {
	const [pauseConfirmOpen, setPauseConfirmOpen] = useState(false);
	const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

	const handleToggleAction = () => {
		if (summary?.isStopping) {
			// Resuming - no confirmation needed usually, but could be added if desired
			onToggleStop(false);
		} else {
			// Pausing - show confirmation
			setPauseConfirmOpen(true);
		}
	};

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="outline"
						className="h-7 px-3 text-xs font-medium rounded border border-zinc-700 bg-zinc-900/50 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
					>
						<MoreVertical className="h-3.5 w-3.5 mr-1" />
						Actions
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="end"
					className="w-56 bg-zinc-950 border-zinc-800 text-zinc-200"
				>
					<DropdownMenuLabel className="text-zinc-500 text-[10px] uppercase tracking-wider">
						Trading Control
					</DropdownMenuLabel>
					{summary && (
						<DropdownMenuItem
							disabled={isTogglePending || isReadonly}
							onClick={handleToggleAction}
							className={`cursor-pointer ${
								summary.isStopping
									? 'text-emerald-400 focus:text-emerald-300 focus:bg-emerald-500/10'
									: 'text-amber-400 focus:text-amber-300 focus:bg-amber-500/10'
							}`}
						>
							{isTogglePending ? (
								'⌛ Updating...'
							) : summary.isStopping ? (
								<>
									<Play className="h-3.5 w-3.5 mr-2" />
									Resume Trading
								</>
							) : (
								<>
									<Pause className="h-3.5 w-3.5 mr-2" />
									Pause New Trades
								</>
							)}
						</DropdownMenuItem>
					)}

					<DropdownMenuSeparator className="bg-zinc-800" />
					<DropdownMenuLabel className="text-zinc-500 text-[10px] uppercase tracking-wider">
						Configuration
					</DropdownMenuLabel>

					<DropdownMenuItem
						onClick={onOpenConfig}
						disabled={!isAdmin}
						className="cursor-pointer focus:bg-zinc-900"
					>
						<Settings2 className="h-3.5 w-3.5 mr-2" />
						Strategy Configuration
					</DropdownMenuItem>

					<DropdownMenuItem
						onClick={onOpenAlerts}
						disabled={!isAdmin}
						className="cursor-pointer focus:bg-zinc-900"
					>
						<Bell className="h-3.5 w-3.5 mr-2" />
						Alerts Configuration
					</DropdownMenuItem>

					<DropdownMenuSeparator className="bg-zinc-800" />
					<DropdownMenuLabel className="text-zinc-500 text-[10px] uppercase tracking-wider">
						Tools & Data
					</DropdownMenuLabel>

					<DropdownMenuItem
						onClick={onExport}
						disabled={!history || !summary || !config}
						className="cursor-pointer focus:bg-zinc-900"
					>
						<Download className="h-3.5 w-3.5 mr-2" />
						Export to Excel
					</DropdownMenuItem>

					<DropdownMenuItem
						onClick={onOpenStartTime}
						disabled={!isAdmin}
						className="cursor-pointer focus:bg-zinc-900"
					>
						<Clock className="h-3.5 w-3.5 mr-2" />
						Change Bot Start Time
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={onOpenVerifyStats}
						disabled={!isAdmin}
						className="cursor-pointer focus:bg-zinc-900"
					>
						<ShieldCheck className="h-3.5 w-3.5 mr-2" />
						Verify Bot Stats
					</DropdownMenuItem>
					<DropdownMenuSeparator className="bg-zinc-800" />

					<DropdownMenuItem
						disabled={isResetPending || isReadonly}
						onSelect={(e) => {
							e.preventDefault();
							setResetConfirmOpen(true);
						}}
						className="cursor-pointer text-red-400 focus:text-red-300 focus:bg-red-500/10"
					>
						<RotateCcw className="h-3.5 w-3.5 mr-2" />
						Reset Bot Data
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			{/* Pause Confirmation Dialog */}
			<Dialog open={pauseConfirmOpen} onOpenChange={setPauseConfirmOpen}>
				<DialogContent className="sm:max-w-[400px] bg-zinc-950 border border-zinc-800 text-zinc-100">
					<DialogHeader>
						<DialogTitle className="text-lg text-amber-400 flex items-center gap-2">
							<Pause className="h-5 w-5" />
							Pause Trading?
						</DialogTitle>
						<DialogDescription className="text-zinc-400">
							This will stop the bot from taking new trades.
							Active trades will still be managed until they
							close.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="gap-2 sm:gap-0">
						<DialogClose asChild>
							<Button
								variant="outline"
								className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
							>
								Cancel
							</Button>
						</DialogClose>
						<Button
							variant="outline"
							className="bg-amber-600 hover:bg-amber-700 text-white border-none"
							onClick={() => {
								onToggleStop(true);
								setPauseConfirmOpen(false);
							}}
						>
							Yes, Pause Trading
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Reset Confirmation Dialog */}
			<Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
				<DialogContent className="sm:max-w-[400px] bg-zinc-950 border border-zinc-800 text-zinc-100">
					<DialogHeader>
						<DialogTitle className="text-lg text-red-400 flex items-center gap-2">
							<RotateCcw className="h-5 w-5" />
							Reset Bot Data?
						</DialogTitle>
						<DialogDescription className="text-zinc-400">
							This will permanently delete active trades,
							history, daily stats, and balance for the current
							mode (demo/live) in both Redis and MongoDB.
							Bot start time will be reset to now.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="gap-2 sm:gap-0">
						<DialogClose asChild>
							<Button
								variant="outline"
								className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
							>
								Cancel
							</Button>
						</DialogClose>
						<Button
							variant="destructive"
							className="bg-red-600 hover:bg-red-700 text-white"
							onClick={() => {
								onOpenReset();
								setResetConfirmOpen(false);
							}}
						>
							{isResetPending
								? 'Resetting...'
								: 'Yes, Reset Everything'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
