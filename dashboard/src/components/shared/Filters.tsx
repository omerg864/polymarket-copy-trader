import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '../ui/select';
import { X } from 'lucide-react';

export interface FilterValues {
	startDate: string;
	endDate: string;
	status: string;
	direction: string;
}

interface FiltersProps {
	values: FilterValues;
	onChange: (values: FilterValues) => void;
	className?: string;
}

export const DEFAULT_FILTERS: FilterValues = {
	startDate: '',
	endDate: '',
	status: 'all',
	direction: 'all',
};

export function Filters({ values, onChange, className = '' }: FiltersProps) {
	const handleChange = (field: keyof FilterValues, value: string) => {
		onChange({ ...values, [field]: value });
	};

	const resetFilters = () => {
		onChange(DEFAULT_FILTERS);
	};

	const hasActiveFilters =
		values.startDate !== '' ||
		values.endDate !== '' ||
		values.status !== 'all' ||
		values.direction !== 'all';

	return (
		<div
			className={`flex flex-wrap gap-4 items-end bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800/50 backdrop-blur-sm shadow-xl ${className}`}
		>
			<div className="flex flex-col gap-2 flex-1 min-w-[160px]">
				<Label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest px-1">
					Start Date
				</Label>
				<Input
					type="date"
					value={values.startDate}
					onChange={(e) => handleChange('startDate', e.target.value)}
					className="bg-zinc-950/50 border-zinc-800 focus:border-emerald-500/50 h-10"
				/>
			</div>

			<div className="flex flex-col gap-2 flex-1 min-w-[160px]">
				<Label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest px-1">
					End Date
				</Label>
				<Input
					type="date"
					value={values.endDate}
					onChange={(e) => handleChange('endDate', e.target.value)}
					className="bg-zinc-950/50 border-zinc-800 focus:border-emerald-500/50 h-10"
				/>
			</div>

			<div className="flex flex-col gap-2 flex-1 min-w-[160px]">
				<Label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest px-1">
					Status
				</Label>
				<Select
					value={values.status}
					onValueChange={(v) => handleChange('status', v)}
				>
					<SelectTrigger className="bg-zinc-950/50 border-zinc-800 focus:ring-emerald-500/20 focus:border-emerald-500/50 h-10">
						<SelectValue placeholder="All Statuses" />
					</SelectTrigger>
					<SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
						<SelectItem value="all">All Statuses</SelectItem>
						<SelectItem value="won">🏆 Won</SelectItem>
						<SelectItem value="lost">❌ Lost</SelectItem>
						<SelectItem value="closed_tp">
							🟢 Take Profit
						</SelectItem>
						<SelectItem value="closed_sl">🔴 Stop Loss</SelectItem>
						<SelectItem value="closed_fct">
							⏱️ Force Close
						</SelectItem>
						<SelectItem value="closed_sell">💰 Sold</SelectItem>
					</SelectContent>
				</Select>
			</div>

			<div className="flex flex-col gap-2 flex-1 min-w-[160px]">
				<Label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest px-1">
					Direction
				</Label>
				<Select
					value={values.direction}
					onValueChange={(v) => handleChange('direction', v)}
				>
					<SelectTrigger className="bg-zinc-950/50 border-zinc-800 focus:ring-emerald-500/20 focus:border-emerald-500/50 h-10">
						<SelectValue placeholder="All Directions" />
					</SelectTrigger>
					<SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
						<SelectItem value="all">All Directions</SelectItem>
						<SelectItem value="UP">▲ UP</SelectItem>
						<SelectItem value="DOWN">▼ DOWN</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{hasActiveFilters && (
				<Button
					variant="ghost"
					size="sm"
					onClick={resetFilters}
					className="h-10 px-4 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/5 flex items-center gap-2 border border-transparent hover:border-rose-500/20 transition-all duration-300"
				>
					<X className="w-4 h-4" />
					<span className="text-xs font-bold uppercase tracking-tighter">
						Reset
					</span>
				</Button>
			)}
		</div>
	);
}
