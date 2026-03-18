import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
} from '@/components/ui/card';
import { Duration } from 'luxon';
import { useEffect, useState } from 'react';

export function TimeStatusCards({
	startTime,
	serverTimezone,
}: {
	startTime?: number | null;
	serverTimezone?: string;
}) {
	const [currentTime, setCurrentTime] = useState(new Date());

	useEffect(() => {
		const timer = setInterval(() => setCurrentTime(new Date()), 1000);
		return () => clearInterval(timer);
	}, []);

	let uptimeStr = '0s';
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
		<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
			<Card className="bg-zinc-900 border-zinc-800">
				<CardHeader className="pb-2">
					<CardDescription className="text-xs text-zinc-500">
						⏱️ Bot Uptime
					</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="text-xl font-bold font-mono text-emerald-400">
						{uptimeStr}
					</p>
				</CardContent>
			</Card>

			<Card className="bg-zinc-900 border-zinc-800">
				<CardHeader className="pb-2">
					<CardDescription className="text-xs text-zinc-500">
						🏠 Local Time
					</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="text-xl font-bold font-mono text-zinc-200">
						{currentTime.toLocaleTimeString('en-US', {
							hour12: false,
						})}
					</p>
				</CardContent>
			</Card>

			<Card className="bg-zinc-900 border-zinc-800">
				<CardHeader className="pb-2">
					<CardDescription className="text-xs text-zinc-500">
						🖥️ Server ({serverTimezone || 'Asia/Jerusalem'})
					</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="text-xl font-bold font-mono text-blue-400">
						{currentTime.toLocaleTimeString('en-US', {
							timeZone: serverTimezone || 'Asia/Jerusalem',
							hour12: false,
						})}
					</p>
				</CardContent>
			</Card>

			<Card className="bg-zinc-900 border-zinc-800">
				<CardHeader className="pb-2">
					<CardDescription className="text-xs text-zinc-500">
						🗽 Eastern Time (ET)
					</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="text-xl font-bold font-mono text-amber-400">
						{currentTime.toLocaleTimeString('en-US', {
							timeZone: 'America/New_York',
							hour12: false,
						})}
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
