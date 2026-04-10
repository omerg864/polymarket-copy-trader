import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useVerifyStats } from '@/hooks/use-api';
import { CheckCircle2, XCircle, ShieldCheck, Loader2, Save } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { VerificationResult } from '@/types';

interface VerificationStatsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function VerificationStatsDialog({
	open,
	onOpenChange,
}: VerificationStatsDialogProps) {
	const [fix, setFix] = useState(false);
	const [result, setResult] = useState<VerificationResult | null>(null);
	const verifyMutation = useVerifyStats();
	const scrollRef = useRef<HTMLDivElement>(null);

	const handleVerify = async () => {
		try {
			const res = await verifyMutation.mutateAsync(fix);
			setResult(res);
		} catch (error) {
			console.error('Check failed', error);
		}
	};

	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [result?.logs]);

	const renderMatch = (match: boolean) => {
		return match ? (
			<CheckCircle2 className="h-4 w-4 text-emerald-500" />
		) : (
			<XCircle className="h-4 w-4 text-red-500" />
		);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col bg-zinc-950 border border-zinc-800 text-zinc-100 overflow-hidden">
				<DialogHeader>
					<DialogTitle className="text-xl text-zinc-100 flex items-center gap-2">
						<ShieldCheck className="h-6 w-6 text-zinc-400" />
						Verify Bot Statistics
					</DialogTitle>
					<DialogDescription className="text-zinc-400">
						Calculates totals from all historical trades in MongoDB
						and compares them with current Redis values.
					</DialogDescription>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto py-4 space-y-4 pr-2 custom-scrollbar">
					{!result && !verifyMutation.isPending && (
						<div className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-6 text-center space-y-4">
							<div className="flex items-center justify-between max-w-[240px] mx-auto">
								<div className="flex flex-col items-start gap-1">
									<Label
										htmlFor="fix-mode"
										className="text-sm font-medium"
									>
										Fix Discrepancies
									</Label>
									<span className="text-[10px] text-zinc-500 text-left">
										Automatically repair Redis values if
										they don't match computed totals.
									</span>
								</div>
								<Switch
									id="fix-mode"
									checked={fix}
									onCheckedChange={setFix}
									className="data-[state=checked]:bg-emerald-600"
								/>
							</div>
							<Button
								onClick={handleVerify}
								className="w-full max-w-[200px] bg-zinc-100 text-zinc-950 hover:bg-zinc-200"
							>
								Start Verification
							</Button>
						</div>
					)}

					{verifyMutation.isPending && (
						<div className="p-12 flex flex-col items-center justify-center gap-4 text-zinc-400">
							<Loader2 className="h-8 w-8 animate-spin" />
							<p className="text-sm font-medium">
								Processing trades, please wait...
							</p>
						</div>
					)}

					{result && (
						<div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
							{/* Summary Cards */}
							<div className="grid grid-cols-2 gap-3">
								<div className="bg-zinc-900/40 p-3 rounded border border-zinc-800/50">
									<p className="text-[10px] uppercase text-zinc-500 mb-1">
										History Trades
									</p>
									<p className="text-lg font-mono font-bold text-zinc-200">
										{result.historyTrades.count}
									</p>
								</div>
								<div className="bg-zinc-900/40 p-3 rounded border border-zinc-800/50">
									<p className="text-[10px] uppercase text-zinc-500 mb-1">
										Active Trades
									</p>
									<p className="text-lg font-mono font-bold text-emerald-400">
										{result.activeTrades.count}
									</p>
								</div>
							</div>

							{/* Comparison Table */}
							<div className="bg-zinc-900/40 border border-zinc-800 rounded-lg overflow-hidden">
								<div className="grid grid-cols-4 p-2 bg-zinc-900 text-[10px] uppercase font-bold text-zinc-500 border-b border-zinc-800">
									<div className="col-span-1">Metric</div>
									<div className="text-right">Computed</div>
									<div className="text-right">Redis</div>
									<div className="text-center">Match</div>
								</div>
								<div className="divide-y divide-zinc-800/50">
									<div className="grid grid-cols-4 p-2 text-xs items-center">
										<div className="col-span-1 text-zinc-400">
											Total PnL
										</div>
										<div className="text-right font-mono">
											$
											{result.computed.sumPnl.toFixed(2)}
										</div>
										<div className="text-right font-mono">
											$
											{result.redis.totalPnl.toFixed(2)}
										</div>
										<div className="flex justify-center">
											{renderMatch(result.matches.pnl)}
										</div>
									</div>
									<div className="grid grid-cols-4 p-2 text-xs items-center">
										<div className="col-span-1 text-zinc-400">
											Total Fees
										</div>
										<div className="text-right font-mono text-amber-500/80">
											$
											{result.computed.sumFees.toFixed(
												4,
											)}
										</div>
										<div className="text-right font-mono text-amber-500/80">
											$
											{result.redis.totalFees.toFixed(4)}
										</div>
										<div className="flex justify-center">
											{renderMatch(result.matches.fees)}
										</div>
									</div>
									<div className="grid grid-cols-4 p-2 text-xs items-center">
										<div className="col-span-1 text-zinc-400">
											Balance
										</div>
										<div className="text-right font-mono text-emerald-400">
											$
											{result.computed.expectedBalance.toFixed(
												2,
											)}
										</div>
										<div className="text-right font-mono text-emerald-400">
											$
											{result.redis.balance.toFixed(2)}
										</div>
										<div className="flex justify-center">
											{renderMatch(
												result.matches.balance,
											)}
										</div>
									</div>
									<div className="grid grid-cols-4 p-2 text-xs items-center">
										<div className="col-span-1 text-zinc-400">
											Wins / Losses
										</div>
										<div className="text-right font-mono">
											{result.computed.wins} /{' '}
											{result.computed.losses}
										</div>
										<div className="text-right font-mono">
											{result.redis.wins} /{' '}
											{result.redis.losses}
										</div>
										<div className="flex justify-center">
											{renderMatch(
												result.matches.wins &&
													result.matches.losses,
											)}
										</div>
									</div>
								</div>
							</div>

							{/* Logs */}
							<div className="space-y-1.5">
								<p className="text-[10px] uppercase text-zinc-500 font-bold ml-1">
									Execution Log
								</p>
								<div
									ref={scrollRef}
									className="bg-zinc-950/80 border border-zinc-800 rounded p-3 font-mono text-[11px] h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed custom-scrollbar"
								>
									{result.logs.map((log, i) => (
										<div
											key={i}
											className={`mb-0.5 ${
												log.includes('✅')
													? 'text-emerald-500/90'
													: log.includes('❌') ||
														  log.includes('⚠️')
														? 'text-amber-400'
														: log.includes('Fixed') ||
															  log.includes('🔧')
															? 'text-sky-400'
															: 'text-zinc-400'
											}`}
										>
											{log}
										</div>
									))}
								</div>
							</div>
						</div>
					)}
				</div>

				<DialogFooter className="border-t border-zinc-800 pt-4 mt-2">
					<Button
						variant="outline"
						className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
						onClick={() => onOpenChange(false)}
					>
						Close
					</Button>
					{result && !result.fix && result.needsFix && (
						<Button
							onClick={() => {
								setFix(true);
								handleVerify();
							}}
							className="bg-amber-600 hover:bg-amber-700 text-white border-none gap-2"
						>
							<Save className="h-4 w-4" />
							Run with Fix
						</Button>
					)}
					{!result && !verifyMutation.isPending && (
						<Button
							onClick={handleVerify}
							disabled={verifyMutation.isPending}
							className="bg-zinc-100 text-zinc-950 hover:bg-zinc-200 gap-2"
						>
							{verifyMutation.isPending ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<ShieldCheck className="h-4 w-4" />
							)}
							Start Verification
						</Button>
					)}
					{result && (
						<Button
							variant="outline"
							onClick={() => {
								setResult(null);
								setFix(false);
							}}
							className="border-zinc-800 text-zinc-400 hover:bg-zinc-900"
						>
							Clear Results
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
