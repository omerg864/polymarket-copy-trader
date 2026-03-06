import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
} from '@/components/ui/card';
import { useSummary } from '@/hooks/use-api';

export function StatsSummary() {
	const { data: summary } = useSummary();

	if (!summary) return null;

	const winRate = parseFloat(summary.winRate);
	const totalPnl = summary.totalPnl;
	const initialBalance = summary.initialBalance ?? 100;
	const pnlPercentage =
		initialBalance > 0 ? (totalPnl / initialBalance) * 100 : 0;

	return (
		<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
			<Card className="bg-zinc-900 border-zinc-800">
				<CardHeader className="pb-2">
					<CardDescription className="text-xs text-zinc-500">
						Balance
					</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="text-2xl font-bold font-mono">
						${summary.balance.toFixed(2)}
					</p>
				</CardContent>
			</Card>

			<Card className="bg-zinc-900 border-zinc-800">
				<CardHeader className="pb-2">
					<CardDescription className="text-xs text-zinc-500">
						Total P&L
					</CardDescription>
				</CardHeader>
				<CardContent>
					<span
						className={`text-2xl font-bold font-mono ${
							totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
						} text-nowrap`}
					>
						{totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
						<br />
						<span className="text-sm font-normal text-zinc-500">
							({totalPnl >= 0 ? '+' : ''}
							{pnlPercentage.toFixed(2)}%)
						</span>
					</span>
				</CardContent>
			</Card>

			<Card className="bg-zinc-900 border-zinc-800">
				<CardHeader className="pb-2">
					<CardDescription className="text-xs text-zinc-500">
						Win Rate
					</CardDescription>
				</CardHeader>
				<CardContent>
					<p
						className={`text-2xl font-bold font-mono ${
							winRate >= 50 ? 'text-emerald-400' : 'text-red-400'
						}`}
					>
						{summary.winRate}%
					</p>
				</CardContent>
			</Card>

			<Card className="bg-zinc-900 border-zinc-800">
				<CardHeader className="pb-2">
					<CardDescription className="text-xs text-zinc-500">
						Total Trades
					</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="text-2xl font-bold font-mono">
						{summary.totalTrades}
					</p>
				</CardContent>
			</Card>

			<Card className="bg-zinc-900 border-zinc-800">
				<CardHeader className="pb-2">
					<CardDescription className="text-xs text-zinc-500">
						Wins / Losses
					</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="text-2xl font-bold font-mono">
						<span className="text-emerald-400">{summary.wins}</span>
						<span className="text-zinc-600"> / </span>
						<span className="text-red-400">{summary.losses}</span>
					</p>
				</CardContent>
			</Card>

			<Card className="bg-zinc-900 border-zinc-800">
				<CardHeader className="pb-2">
					<CardDescription className="text-xs text-zinc-500">
						Active Trades
					</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="text-2xl font-bold font-mono text-blue-400">
						{summary.activeTrades}
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
