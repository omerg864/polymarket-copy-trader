import { useSummary } from '@/hooks/use-api';
import { Header } from './dashboard/Header';
import { StatsSummary } from './dashboard/StatsSummary';
import { ActiveTradesTable } from './dashboard/ActiveTradesTable';
import { TradeHistoryTable } from './dashboard/TradeHistoryTable';

export function Dashboard() {
	const { isLoading: summaryLoading } = useSummary();

	if (summaryLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-zinc-950">
				<div className="text-zinc-400 text-lg animate-pulse">
					Loading dashboard...
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
			<div className="max-w-7xl mx-auto space-y-6">
				<Header />
				<StatsSummary />
				<ActiveTradesTable />
				<TradeHistoryTable />
			</div>
		</div>
	);
}
