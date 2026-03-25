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
	max,
	type = 'number',
	options,
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
	max?: number;
	type?: string;
	options?: string[];
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
		if (type === 'select' && Array.isArray(options)) {
			return (
				<>
					<span className="text-zinc-500 flex items-center">
						{label}
					</span>
					<select
						value={editValues[field] as string}
						onChange={(e) => {
							const val = e.target.value;
							setEditValues((prev: Partial<StrategyConfig>) => ({
								...prev,
								[field]: val,
							}));
						}}
						className="w-full px-2 py-0.5 rounded border border-zinc-700 bg-zinc-800 text-zinc-100 text-right text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
					>
						{options.map((opt) => (
							<option key={opt} value={opt}>
								{opt}
							</option>
						))}
					</select>
				</>
			);
		}
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

						if (type === 'number') {
							const parsed = parseFloat(val);
							if (!isNaN(parsed)) {
								let finalVal =
									min !== undefined
										? Math.max(min, parsed)
										: parsed;
								if (max !== undefined) {
									finalVal = Math.min(max, finalVal);
								}
								setEditValues(
									(prev: Partial<StrategyConfig>) => ({
										...prev,
										[field]: finalVal,
									}),
								);
							}
						} else {
							setEditValues((prev: Partial<StrategyConfig>) => ({
								...prev,
								[field]: val,
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
