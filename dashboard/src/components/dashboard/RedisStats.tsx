import { useRedisStats } from '@/hooks/use-api';
import type { FC } from 'react';
import { Badge } from '../ui/badge';
import { Database } from 'lucide-react';

const maxMemory = 1024 * 1024 * 30; // 30MB

const RedisStats: FC = () => {
	const { data: redisStats } = useRedisStats();

	const percent = redisStats
		? (redisStats.memoryUsedBytes / maxMemory) * 100
		: 0;

	let iconColor = 'text-emerald-500/80';
	if (percent >= 90) {
		iconColor = 'text-red-500';
	} else if (percent >= 75) {
		iconColor = 'text-orange-400';
	}

	return (
		<div className="inline-block">
			{redisStats && (
				<Badge
					variant="outline"
					className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono text-zinc-400 border-zinc-700/50 bg-zinc-900/50"
				>
					<Database className={`h-3 w-3 ${iconColor}`} />
					{redisStats.memoryUsed} ({redisStats.totalKeys} keys)
				</Badge>
			)}
		</div>
	);
};

export default RedisStats;
