import { useMongoStats } from '@/hooks/use-api';
import type { FC } from 'react';
import { Badge } from '../ui/badge';
import { Database } from 'lucide-react';

const maxMemory = 1024 * 1024 * 512; // 512MB

const MongoStats: FC = () => {
	const { data: mongoStats } = useMongoStats();

	const percent = mongoStats
		? (mongoStats.storageSizeInBytes / maxMemory) * 100
		: 0;

	let iconColor = 'text-blue-500/80';
	if (percent >= 90) {
		iconColor = 'text-red-500';
	} else if (percent >= 75) {
		iconColor = 'text-orange-400';
	}

	return (
		<div className="inline-block">
			{mongoStats && (
				<Badge
					variant="outline"
					className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono text-zinc-400 border-zinc-700/50 bg-zinc-900/50"
				>
					<Database className={`h-3 w-3 ${iconColor}`} />
					{mongoStats.storageSize} ({mongoStats.totalTrades} trades)
				</Badge>
			)}
		</div>
	);
};

export default MongoStats;
