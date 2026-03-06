import { useState, useEffect } from 'react';

export function HeaderClocks() {
	const [currentTime, setCurrentTime] = useState(new Date());

	useEffect(() => {
		const timer = setInterval(() => setCurrentTime(new Date()), 1000);
		return () => clearInterval(timer);
	}, []);

	return (
		<div className="text-xs text-zinc-400 mt-2 flex gap-4 font-mono">
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
