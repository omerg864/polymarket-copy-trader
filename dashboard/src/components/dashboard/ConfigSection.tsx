import React from 'react';

export function ConfigSection({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-2">
			<h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
				{title}
			</h3>
			<div className="grid grid-cols-2 gap-2 text-sm">{children}</div>
		</div>
	);
}
