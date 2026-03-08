import { useSummary } from '@/hooks/use-api';
import { ActiveTradesTable } from './dashboard/ActiveTradesTable';
import { Header } from './dashboard/Header';
import { MarketPricesCards } from './dashboard/MarketPricesCards';
import { StatsSummary } from './dashboard/StatsSummary';
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
		<div className="min-h-screen bg-zinc-950 text-zinc-100 p-3 sm:p-6">
			<div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
				<Header />
				<StatsSummary />
				<MarketPricesCards />
				<ActiveTradesTable />
				<TradeHistoryTable />
			</div>
		</div>
	);
}
