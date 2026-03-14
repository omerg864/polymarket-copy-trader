import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { useUpdateNotificationConfig } from '@/hooks/use-api';
import type { NotificationConfig } from '@/types';
import { Copy, ExternalLink, Pencil } from 'lucide-react';
import { useCallback, useState } from 'react';
import { ConfigRowNotification } from './ConfigRowNotification';
import { ConfigSection } from './ConfigSection';

interface NotificationConfigDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	notificationConfig: NotificationConfig | undefined;
	isAdmin: boolean;
	refetchNotificationConfig: () => void;
}

export function NotificationConfigDialog({
	open,
	onOpenChange,
	notificationConfig,
	isAdmin,
	refetchNotificationConfig,
}: NotificationConfigDialogProps) {
	const updateNotificationConfig = useUpdateNotificationConfig();
	const [editing, setEditing] = useState(false);
	const [editValues, setEditValues] = useState<Partial<NotificationConfig>>({});
	const [prevConfig, setPrevConfig] = useState(notificationConfig);
	const [prevOpen, setPrevOpen] = useState(open);

	if (notificationConfig !== prevConfig || open !== prevOpen) {
		setPrevConfig(notificationConfig);
		setPrevOpen(open);
		if (open && notificationConfig) {
			setEditValues(notificationConfig);
			setEditing(false);
		}
	}

	const resetEditValues = useCallback(() => {
		if (notificationConfig) {
			setEditValues(notificationConfig);
		}
		setEditing(false);
	}, [notificationConfig]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[425px] bg-zinc-950 border border-zinc-800 text-zinc-100">
				<DialogHeader>
					<DialogTitle className="text-xl flex items-center justify-between">
						Notification Settings
						{isAdmin && !editing && (
							<Button
								variant="ghost"
								size="sm"
								className="h-7 px-2 text-zinc-400 hover:text-zinc-200"
								onClick={() => setEditing(true)}
							>
								<Pencil className="h-3.5 w-3.5 mr-1" />
								Edit
							</Button>
						)}
					</DialogTitle>
				</DialogHeader>
				<div className="pt-2">
					<div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 space-y-2">
						<div className="flex items-center justify-between">
							<span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
								Telegram Bot
							</span>
							<Button
								variant="ghost"
								size="sm"
								className="h-6 px-2 text-[10px] text-zinc-400 hover:text-zinc-200"
								onClick={() => {
									const url = import.meta.env.VITE_BOT_URL;
									if (url) {
										navigator.clipboard.writeText(url);
									}
								}}
							>
								<Copy className="h-3 w-3 mr-1" />
								Copy
							</Button>
						</div>
						<div className="flex items-center gap-2">
							<a
								href={import.meta.env.VITE_BOT_URL}
								target="_blank"
								rel="noopener noreferrer"
								className="text-sm text-blue-400 hover:text-blue-300 transition-colors break-all flex items-center gap-1.5"
							>
								{import.meta.env.VITE_BOT_URL || 'Not Configured'}
								<ExternalLink className="h-3 w-3 shrink-0" />
							</a>
						</div>
					</div>
				</div>
				{notificationConfig ? (
					<div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
						<ConfigSection title="PnL Thresholds">
							<ConfigRowNotification
								label="Min Today P&L"
								field="minTodayPnLNotification"
								prefix="$"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
							/>
							<ConfigRowNotification
								label="Max Today P&L"
								field="maxTodayPnLNotification"
								prefix="$"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
							/>
						</ConfigSection>

						<ConfigSection title="Events">
							<ConfigRowNotification
								label="Notify on Win"
								field="notificationOnWin"
								type="switch"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
							/>
							<ConfigRowNotification
								label="Notify on Loss"
								field="notificationOnLoss"
								type="switch"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
							/>
							<ConfigRowNotification
								label="Notify on P&L Goal"
								field="notificationOnPnlGoal"
								type="switch"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
							/>
							<ConfigRowNotification
								label="Notify on Error"
								field="notificationOnError"
								type="switch"
								editing={editing}
								editValues={editValues}
								setEditValues={setEditValues}
							/>
						</ConfigSection>
					</div>
				) : (
					<div className="py-8 text-center text-zinc-500 animate-pulse">
						Loading notification settings...
					</div>
				)}
				{editing && (
					<DialogFooter className="gap-2 sm:gap-0">
						<Button
							variant="outline"
							className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
							onClick={() => {
								resetEditValues();
							}}
						>
							Cancel
						</Button>
						<Button
							className="bg-blue-600 hover:bg-blue-700 text-white"
							disabled={updateNotificationConfig.isPending}
							onClick={() => {
								updateNotificationConfig.mutate(editValues, {
									onSuccess: () => {
										setEditing(false);
										refetchNotificationConfig();
									},
								});
							}}
						>
							{updateNotificationConfig.isPending ? '⌛ Saving...' : 'Save Changes'}
						</Button>
					</DialogFooter>
				)}
			</DialogContent>
		</Dialog>
	);
}
