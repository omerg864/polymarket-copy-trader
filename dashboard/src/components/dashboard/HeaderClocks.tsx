import { useEffect, useState } from 'react';

export function HeaderClocks({ startTime }: { startTime?: number | null }) {
	const [currentTime, setCurrentTime] = useState(new Date());

	useEffect(() => {
		const timer = setInterval(() => setCurrentTime(new Date()), 1000);
		return () => clearInterval(timer);
	}, []);

	let uptimeStr = '';
	if (startTime) {
		const diff = Math.max(
			0,
			Math.floor((currentTime.getTime() - startTime) / 1000),
		);
		const h = Math.floor(diff / 3600);
		const m = Math.floor((diff % 3600) / 60);
		const s = diff % 60;
		if (h > 0) {
			uptimeStr = `${h}h ${m}m ${s}s`;
		} else if (m > 0) {
			uptimeStr = `${m}m ${s}s`;
		} else {
			uptimeStr = `${s}s`;
		}
	}

	return (
		<div className="text-xs text-zinc-400 mt-2 flex flex-wrap gap-2 sm:gap-4 font-mono items-center">
			{uptimeStr && (
				<span className="text-emerald-400/90 bg-emerald-400/10 px-1.5 py-0.5 rounded">
					⏱️ Uptime: {uptimeStr}
				</span>
			)}
			<span>
				📍 Local:{' '}
				{currentTime.toLocaleTimeString('en-US', { hour12: false })}
			</span>
			<span>
				🗽 ET:{' '}
				{currentTime.toLocaleTimeString('en-US', {
					timeZone: 'America/New_York',
					hour12: false,
				})}
			</span>
		</div>
	);
}
