import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
} from '@/components/ui/card';
import { useMarketPrices } from '@/hooks/use-api';
import { MarketOutcomeBadge } from './badges';

const fmtPrice = (n: number | undefined) =>
	n?.toLocaleString(undefined, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});

const fmtTime = (ts: number) =>
	new Date(ts).toLocaleTimeString(undefined, {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	});

export function MarketPricesCards() {
	const { data: marketPrices } = useMarketPrices();

	if (!marketPrices?.btcPrice) return null;

	const {
		btcPrice,
		priceToBeat,
		updatedAt,
		marketTitle,
		upPrice,
		downPrice,
	} = marketPrices;
	const diff = priceToBeat ? btcPrice - priceToBeat : null;
	const diffPercent = priceToBeat ? (diff! / priceToBeat) * 100 : null;
	const isAbove = diff !== null && diff >= 0;

	return (
		<div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-4 mb-4">
			<Card className="bg-zinc-900 border-zinc-800">
				<CardHeader className="pb-2">
					<CardDescription className="text-xs text-zinc-500">
						₿ BTC Price
					</CardDescription>
				</CardHeader>
				<CardContent>
					<p
						className={`text-2xl font-bold font-mono ${
							isAbove ? 'text-emerald-400' : 'text-red-400'
						}`}
					>
						${fmtPrice(btcPrice)}
					</p>
					{priceToBeat && (
						<div
							className={`flex flex-wrap gap-x-2 text-sm font-normal ${
								isAbove ? 'text-emerald-400' : 'text-red-400'
							}`}
						>
							<span>(${fmtPrice(diff!)})</span>
							<span>
								({isAbove ? '+' : ''}${diffPercent?.toFixed(3)}
								%)
							</span>
						</div>
					)}
					{updatedAt && (
						<p className="text-xs text-zinc-500 mt-1">
							Updated {fmtTime(updatedAt)}
						</p>
					)}
				</CardContent>
			</Card>

			{priceToBeat && (
				<Card className="bg-zinc-900 border-zinc-800">
					<CardHeader className="pb-2">
						<CardDescription className="text-xs text-zinc-500">
							Price To Beat
						</CardDescription>
					</CardHeader>
					<CardContent>
						<span
							className={`text-2xl font-bold font-mono text-amber-500`}
						>
							${fmtPrice(priceToBeat)}
						</span>
						<br />
						{marketTitle && (
							<p className="text-xs text-zinc-500 mt-1 text-wrap">
								{marketTitle}
							</p>
						)}
					</CardContent>
				</Card>
			)}

			{upPrice !== null && (
				<Card className="bg-zinc-900 border-zinc-800">
					<CardHeader className="pb-2">
						<CardDescription className="text-xs">
							<MarketOutcomeBadge outcome="UP" className="pb-0" />
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-bold font-mono text-emerald-400">
							${upPrice.toFixed(3)}
						</p>
						<p className="text-xs text-zinc-500 mt-1">
							Current "Yes" price
						</p>
					</CardContent>
				</Card>
			)}

			{downPrice !== null && (
				<Card className="bg-zinc-900 border-zinc-800">
					<CardHeader className="pb-2">
						<CardDescription className="text-xs text-zinc-500">
							<MarketOutcomeBadge
								outcome="DOWN"
								className="pb-0"
							/>
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-bold font-mono text-red-400">
							${downPrice.toFixed(3)}
						</p>
						<p className="text-xs text-zinc-500 mt-1">
							Current "No" price
						</p>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
