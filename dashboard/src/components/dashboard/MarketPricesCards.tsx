import { useMarketPrices } from '@/hooks/use-api';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Clock, Info } from 'lucide-react';
import { DateTime } from 'luxon';

export function MarketPricesCards() {
	const { data: marketData, isLoading } = useMarketPrices();

	if (isLoading || !marketData) {
		return null;
	}

	const updatedAt = DateTime.fromMillis(marketData.updatedAt).toRelative();

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{/* Market Info Card */}
			<Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-sm">
				<CardContent className="p-4 flex items-center space-x-4">
					<div className="p-2 bg-blue-500/10 rounded-lg">
						<Info className="w-5 h-5 text-blue-400" />
					</div>
					<div>
						<p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
							Active Market
						</p>
						<h3 className="text-sm font-semibold text-zinc-200 truncate max-w-[200px]">
							{marketData.marketTitle || 'General Polymarket'}
						</h3>
					</div>
				</CardContent>
			</Card>

			{/* UP Price Card */}
			{marketData.upPrice !== null && (
				<Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-sm">
					<CardContent className="p-4 flex items-center space-x-4">
						<div className="p-2 bg-emerald-500/10 rounded-lg">
							<TrendingUp className="w-5 h-5 text-emerald-400" />
						</div>
						<div>
							<p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
								UP / YES Price
							</p>
							<h3 className="text-xl font-bold text-emerald-400">
								${marketData.upPrice.toFixed(2)}
							</h3>
						</div>
					</CardContent>
				</Card>
			)}

			{/* DOWN Price Card */}
			{marketData.downPrice !== null && (
				<Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-sm">
					<CardContent className="p-4 flex items-center space-x-4">
						<div className="p-2 bg-red-500/10 rounded-lg">
							<TrendingDown className="w-5 h-5 text-red-400" />
						</div>
						<div>
							<p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
								DOWN / NO Price
							</p>
							<h3 className="text-xl font-bold text-red-400">
								${marketData.downPrice.toFixed(2)}
							</h3>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Last Update Card (Only if no space for it in grid, but let's put it in a corner or just footer) */}
			<div className="col-span-full flex justify-end">
				<div className="flex items-center space-x-1.5 text-[10px] text-zinc-600 uppercase tracking-widest font-semibold">
					<Clock className="w-3 h-3" />
					<span>Updated {updatedAt}</span>
				</div>
			</div>
		</div>
	);
}
