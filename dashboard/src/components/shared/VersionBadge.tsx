import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { useVersions } from '@/hooks/use-api';
import { VersionModal } from './VersionModal';
import pkg from '../../../package.json';

export function VersionBadge() {
	const { data: versions } = useVersions();
	const [isModalOpen, setIsModalOpen] = useState(false);
	const clientVersion = pkg.version;

	const hasMismatch =
		!versions?.api ||
		!versions?.bot ||
		(versions?.api && versions.api !== clientVersion) ||
		(versions?.bot && versions.bot !== clientVersion);

	const badgeVariant = hasMismatch ? 'destructive' : 'outline';

	return (
		<>
			<Badge
				variant={badgeVariant}
				className={`text-[10px] cursor-pointer hover:bg-zinc-800 transition-colors border ${
					hasMismatch
						? 'bg-red-500/20 text-red-400 border-red-500/50 hover:bg-red-500/30'
						: 'text-zinc-500 font-mono border-zinc-800'
				}`}
				onClick={() => setIsModalOpen(true)}
			>
				v{clientVersion}
			</Badge>

			<VersionModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				versions={versions}
			/>
		</>
	);
}
