import React from 'react';
import type { StrategyConfig } from '@/types';

export function ConfigRow({
	label,
	field,
	prefix,
	suffix,
	editing,
	editValues,
	setEditValues,
}: {
	label: string;
	field: keyof StrategyConfig;
	prefix?: string;
	suffix?: string;
	editing: boolean;
	editValues: Partial<StrategyConfig>;
	setEditValues: React.Dispatch<
		React.SetStateAction<Partial<StrategyConfig>>
	>;
}) {
	const value = editValues[field];

	if (editing) {
		return (
			<>
				<span className="text-zinc-500 flex items-center">{label}</span>
				<input
					type="number"
					step="any"
					value={value ?? ''}
					onChange={(e) =>
						setEditValues((prev: Partial<StrategyConfig>) => ({
							...prev,
							[field]: parseFloat(e.target.value) || 0,
						}))
					}
					className="w-full px-2 py-0.5 rounded border border-zinc-700 bg-zinc-800 text-zinc-100 text-right text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
				/>
			</>
		);
	}

	return (
		<>
			<span className="text-zinc-500">{label}</span>
			<span className="text-right">
				{prefix}
				{value}
				{suffix}
			</span>
		</>
	);
}
