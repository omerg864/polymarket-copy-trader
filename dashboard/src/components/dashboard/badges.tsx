import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function PnlBadge({ pnl, cost }: { pnl: number; cost?: number }) {
	const pctChg = cost ? (pnl / cost) * 100 : 0;
	const pctStr =
		cost && pnl !== 0
			? ` (${pctChg > 0 ? '+' : ''}${pctChg.toFixed(1)}%)`
			: '';

	if (pnl > 0)
		return (
			<Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
				+${pnl.toFixed(2)}
				{pctStr}
			</Badge>
		);
	if (pnl < 0)
		return (
			<Badge className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/20">
				-${Math.abs(pnl).toFixed(2)}
				{pctStr}
			</Badge>
		);
	return <Badge variant="secondary">$0.00{cost ? ' (0.0%)' : ''}</Badge>;
}

export function DirectionBadge({ direction }: { direction: string }) {
	return direction === 'UP' ? (
		<Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
			▲ UP
		</Badge>
	) : (
		<Badge className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/20">
			▼ DOWN
		</Badge>
	);
}

export function StatusBadge({ status }: { status: string }) {
	const map: Record<string, { label: string; cls: string }> = {
		won: {
			label: '🏆 Won',
			cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
		},
		lost: {
			label: '❌ Lost',
			cls: 'bg-red-500/20 text-red-400 border-red-500/30',
		},
		open: {
			label: '⏳ Open',
			cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
		},
		closed_tp: {
			label: '🟢 Take Profit',
			cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
		},
		closed_sl: {
			label: '🔴 Stop Loss',
			cls: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
		},
		closed_sell: {
			label: '💰 Sold',
			cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
		},
		closed_fct: {
			label: '⏱️ Force Close',
			cls: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
		},
		awaiting_resolve: {
			label: '🤞 Awaiting Resolve',
			cls: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
		},
	};
	const s = map[status];
	if (s)
		return <Badge className={`${s.cls} hover:${s.cls}`}>{s.label}</Badge>;
	return <Badge variant="outline">{status}</Badge>;
}

export function MarketOutcomeBadge({
	outcome,
	className,
}: {
	outcome?: 'UP' | 'DOWN' | 'UNKNOWN';
	className?: string;
}) {
	if (outcome === 'UP')
		return (
			<Badge
				className={cn(
					'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20',
					className,
				)}
			>
				▲ UP
			</Badge>
		);
	if (outcome === 'DOWN')
		return (
			<Badge
				className={cn(
					'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/20',
					className,
				)}
			>
				▼ DOWN
			</Badge>
		);
	return (
		<Badge
			variant="outline"
			className={cn('text-zinc-500 border-zinc-800', className)}
		>
			UNKNOWN
		</Badge>
	);
}

export function ExpectedOutcomeBadge({
	isCorrect,
	className,
}: {
	isCorrect?: boolean | null;
	className?: string;
}) {
	if (isCorrect === true) {
		return (
			<Badge
				className={cn(
					'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 font-bold',
					className,
				)}
			>
				TRUE
			</Badge>
		);
	}
	if (isCorrect === false) {
		return (
			<Badge
				className={cn(
					'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/20 font-bold',
					className,
				)}
			>
				FALSE
			</Badge>
		);
	}
	return (
		<Badge
			variant="outline"
			className={cn('text-zinc-500 border-zinc-800 italic', className)}
		>
			UNKNOWN
		</Badge>
	);
}
