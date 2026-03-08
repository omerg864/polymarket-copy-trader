import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
} from '@/components/ui/card';
import { useMarketPrices } from '@/hooks/use-api';

const fmtPrice = (n: number) =>
	n.toLocaleString(undefined, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});

export function MarketPricesCards() {
	const { data: marketPrices } = useMarketPrices();

	if (!marketPrices?.btcPrice) return null;

	const { btcPrice, priceToBeat } = marketPrices;
	const diff = priceToBeat ? btcPrice - priceToBeat : null;
	const isAbove = diff !== null && diff >= 0;

	return (
		<div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
			<Card className="bg-zinc-900 border-zinc-800">
				<CardHeader className="pb-2">
					<CardDescription className="text-xs text-zinc-500">
						₿ BTC Price
					</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="text-2xl font-bold font-mono text-amber-400">
						${fmtPrice(btcPrice)}
					</p>
				</CardContent>
			</Card>

			{priceToBeat && (
				<Card className="bg-zinc-900 border-zinc-800">
					<CardHeader className="pb-2">
						<CardDescription className="text-xs text-zinc-500">
							🎯 Reference Price
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p
							className={`text-2xl font-bold font-mono ${
								isAbove ? 'text-emerald-400' : 'text-red-400'
							}`}
						>
							${fmtPrice(priceToBeat)}
						</p>
					</CardContent>
				</Card>
			)}

			{diff !== null && (
				<Card className="bg-zinc-900 border-zinc-800">
					<CardHeader className="pb-2">
						<CardDescription className="text-xs text-zinc-500">
							{isAbove ? '📈' : '📉'} Diff
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p
							className={`text-2xl font-bold font-mono ${
								isAbove ? 'text-emerald-400' : 'text-red-400'
							}`}
						>
							{isAbove ? '+' : ''}${fmtPrice(diff)}
						</p>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
