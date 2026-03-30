import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { type BotVersions } from '@shared/types';
import pkg from '../../../package.json';

interface VersionModalProps {
	isOpen: boolean;
	onClose: () => void;
	versions: BotVersions | undefined;
}

export function VersionModal({ isOpen, onClose, versions }: VersionModalProps) {
	const clientVersion = pkg.version;
	const isApiMismatch =
		!versions?.api || (versions?.api && versions.api !== clientVersion);
	const isBotMismatch =
		!versions?.bot || (versions?.bot && versions.bot !== clientVersion);

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800 text-zinc-100">
				<DialogHeader>
					<DialogTitle className="text-xl font-bold flex items-center gap-2">
						<span>🔧</span> System Versions
					</DialogTitle>
				</DialogHeader>
				<div className="space-y-4 py-4">
					<div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
						<div className="flex flex-col">
							<span className="text-sm font-medium text-zinc-300">
								Dashboard (Client)
							</span>
							<span className="text-[10px] text-zinc-500 uppercase font-bold">
								Frontend
							</span>
						</div>
						<Badge
							variant="outline"
							className="font-mono bg-zinc-950"
						>
							v{clientVersion}
						</Badge>
					</div>

					<div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
						<div className="flex flex-col">
							<span className="text-sm font-medium text-zinc-300">
								API Server
							</span>
							<span className="text-[10px] text-zinc-500 uppercase font-bold">
								Backend
							</span>
						</div>
						<div className="flex flex-col items-end gap-1">
							<Badge
								variant="outline"
								className={`font-mono ${isApiMismatch ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-zinc-950'}`}
							>
								{versions?.api ? `v${versions.api}` : 'Unknown'}
							</Badge>
							{isApiMismatch && (
								<span className="text-[9px] text-red-400 animate-pulse">
									Version Mismatch
								</span>
							)}
						</div>
					</div>

					<div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
						<div className="flex flex-col">
							<span className="text-sm font-medium text-zinc-300">
								Trading Bot
							</span>
							<span className="text-[10px] text-zinc-500 uppercase font-bold">
								Engine
							</span>
						</div>
						<div className="flex flex-col items-end gap-1">
							<Badge
								variant="outline"
								className={`font-mono ${isBotMismatch ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-zinc-950'}`}
							>
								{versions?.bot ? `v${versions.bot}` : 'Unknown'}
							</Badge>
							{isBotMismatch && (
								<span className="text-[9px] text-red-400 animate-pulse">
									Version Mismatch
								</span>
							)}
						</div>
					</div>
				</div>
				<div className="text-[10px] text-zinc-500 text-center mt-2 italic">
					Ensure all services are updated to match the client version
					for stability.
				</div>
			</DialogContent>
		</Dialog>
	);
}
