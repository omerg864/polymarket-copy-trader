import { Duration } from 'luxon';
import { useEffect, useState } from 'react';

export function HeaderClocks({ startTime }: { startTime?: number | null }) {
	const [currentTime, setCurrentTime] = useState(new Date());

	useEffect(() => {
		const timer = setInterval(() => setCurrentTime(new Date()), 1000);
		return () => clearInterval(timer);
	}, []);

	let uptimeStr = '';
	if (startTime) {
		const diffMs = Math.max(0, currentTime.getTime() - startTime);
		const dur = Duration.fromMillis(diffMs).shiftTo(
			'weeks',
			'days',
			'hours',
			'minutes',
			'seconds',
		);
		const parts: string[] = [];
		if (dur.weeks >= 1) parts.push(`${Math.floor(dur.weeks)}w`);
		if (dur.days >= 1) parts.push(`${Math.floor(dur.days)}d`);
		if (dur.hours >= 1) parts.push(`${Math.floor(dur.hours)}h`);
		if (dur.minutes >= 1) parts.push(`${Math.floor(dur.minutes)}m`);
		parts.push(`${Math.floor(dur.seconds)}s`);
		uptimeStr = parts.join(' ');
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
