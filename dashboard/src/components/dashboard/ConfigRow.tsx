import React, { useState } from 'react';
import type { StrategyConfig } from '@/types';

export function ConfigRow({
	label,
	field,
	prefix,
	suffix,
	editing,
	editValues,
	setEditValues,
	min,
	type = 'number',
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
	min?: number;
	type?: string;
}) {
	const value = editValues[field];
	const [inputValue, setInputValue] = useState<string>(
		value?.toString() ?? '',
	);
	const [prevValue, setPrevValue] = useState<typeof value>(value);

	// Sync local state if parent value changes (e.g. from another part of the app)
	if (value !== prevValue) {
		setPrevValue(value);
		setInputValue(value?.toString() ?? '');
	}

	if (editing) {
		return (
			<>
				<span className="text-zinc-500 flex items-center">{label}</span>
				<input
					type={type}
					step="any"
					value={inputValue}
					onChange={(e) => {
						const val = e.target.value;
						setInputValue(val);

						// Only update parent if it's a valid number
						const parsed = parseFloat(val);
						if (!isNaN(parsed)) {
							// Apply min constraint if provided
							const finalVal =
								min !== undefined ? Math.max(min, parsed) : parsed;
							setEditValues((prev: Partial<StrategyConfig>) => ({
								...prev,
								[field]: finalVal,
							}));
						}
					}}
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
