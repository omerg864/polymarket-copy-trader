import { ActiveTradesTable } from './dashboard/ActiveTradesTable';
import { Header } from './dashboard/Header';
import { StatsSummary } from './dashboard/StatsSummary';
import { TimeStatusCards } from './dashboard/TimeStatusCards';
import { TradeHistoryTable } from './dashboard/TradeHistoryTable';
import { useConfig, useSummary } from '@/hooks/use-api';

export function Dashboard() {
	const { data: summary, isLoading: summaryLoading } = useSummary();
	const { data: config } = useConfig();

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
		<div className="min-h-screen bg-zinc-950 text-zinc-100 p-3 sm:p-6">
			<div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
				<Header />
				<TimeStatusCards
					startTime={summary?.botStartTime}
					serverTimezone={config?.timezone}
				/>
				<StatsSummary />
				<ActiveTradesTable />
				<TradeHistoryTable />
			</div>
		</div>
	);
}
