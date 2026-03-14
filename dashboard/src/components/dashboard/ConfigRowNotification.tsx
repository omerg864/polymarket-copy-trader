import { Switch } from '@/components/ui/switch';
import type { NotificationConfig } from '@/types';
import React from 'react';

export function ConfigRowNotification({
	label,
	field,
	prefix,
	suffix,
	type = 'number',
	editing,
	editValues,
	setEditValues,
}: {
	label: string;
	field: keyof NotificationConfig;
	prefix?: string;
	suffix?: string;
	type?: 'number' | 'switch';
	editing: boolean;
	editValues: Partial<NotificationConfig>;
	setEditValues: React.Dispatch<
		React.SetStateAction<Partial<NotificationConfig>>
	>;
}) {
	const value = editValues[field];

	if (editing) {
		return (
			<>
				<span className="text-zinc-500 flex items-center">{label}</span>
				{type === 'switch' ? (
					<Switch
						checked={!!value}
						onCheckedChange={(checked) =>
							setEditValues(
								(prev: Partial<NotificationConfig>) => ({
									...prev,
									[field]: checked,
								}),
							)
						}
						className="justify-self-end"
					/>
				) : (
					<input
						type="number"
						step="any"
						value={typeof value === 'number' ? value : ''}
						onChange={(e) =>
							setEditValues(
								(prev: Partial<NotificationConfig>) => ({
									...prev,
									[field]: parseFloat(e.target.value) || 0,
								}),
							)
						}
						className="w-full px-2 py-0.5 rounded border border-zinc-700 bg-zinc-800 text-zinc-100 text-right text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
					/>
				)}
			</>
		);
	}

	return (
		<>
			<span className="text-zinc-500">{label}</span>
			<span className="text-right">
				{type === 'switch' ? (
					value ? (
						<span className="text-emerald-400">Yes</span>
					) : (
						<span className="text-red-400">No</span>
					)
				) : (
					<>
						{prefix}
						{value}
						{suffix}
					</>
				)}
			</span>
		</>
	);
}
