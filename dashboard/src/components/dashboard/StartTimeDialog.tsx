import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUpdateBotStartTime } from '@/hooks/use-api';
import { DateTime } from 'luxon';
import { useState } from 'react';

interface StartTimeDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentStartTime: number | null | undefined;
	onSuccess: () => void;
}

export function StartTimeDialog({
	open,
	onOpenChange,
	currentStartTime,
	onSuccess,
}: StartTimeDialogProps) {
	const updateStartTime = useUpdateBotStartTime();
	const [epoch, setEpoch] = useState<string>(() =>
		currentStartTime ? currentStartTime.toString() : '',
	);
	const [dateTime, setDateTime] = useState<string>(() =>
		currentStartTime
			? DateTime.fromMillis(currentStartTime).toFormat(
					"yyyy-MM-dd'T'HH:mm",
				)
			: '',
	);

	const handleEpochChange = (val: string) => {
		setEpoch(val);
		const num = parseInt(val, 10);
		if (!isNaN(num)) {
			setDateTime(
				DateTime.fromMillis(num).toFormat("yyyy-MM-dd'T'HH:mm"),
			);
		}
	};

	const handleDateTimeChange = (val: string) => {
		setDateTime(val);
		if (val) {
			const dt = DateTime.fromISO(val);
			if (dt.isValid) {
				setEpoch(dt.toMillis().toString());
			}
		}
	};

	const handleSave = () => {
		const num = parseInt(epoch, 10);
		if (isNaN(num)) return;

		updateStartTime.mutate(num, {
			onSuccess: () => {
				onSuccess();
				onOpenChange(false);
			},
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[425px] bg-zinc-950 border border-zinc-800 text-zinc-100">
				<DialogHeader>
					<DialogTitle>Change Bot Start Time</DialogTitle>
					<DialogDescription className="text-zinc-400 text-xs">
						Updating the start time affects uptime calculation and
						some dashboard statistics.
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-4 py-4">
					<div className="grid gap-2">
						<Label htmlFor="epoch" className="text-zinc-300">
							Epoch (ms)
						</Label>
						<Input
							id="epoch"
							type="number"
							value={epoch}
							onChange={(e) => handleEpochChange(e.target.value)}
							className="bg-zinc-900 border-zinc-700 text-zinc-100"
						/>
					</div>

					<div className="grid gap-2">
						<Label htmlFor="datetime" className="text-zinc-300">
							Date & Time
						</Label>
						<Input
							id="datetime"
							type="datetime-local"
							value={dateTime}
							onChange={(e) =>
								handleDateTimeChange(e.target.value)
							}
							className="bg-zinc-900 border-zinc-700 text-zinc-100"
						/>
					</div>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button
						className="bg-indigo-600 hover:bg-indigo-700 text-white"
						disabled={updateStartTime.isPending || !epoch}
						onClick={handleSave}
					>
						{updateStartTime.isPending
							? '⌛ Updating...'
							: 'Update Start Time'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
