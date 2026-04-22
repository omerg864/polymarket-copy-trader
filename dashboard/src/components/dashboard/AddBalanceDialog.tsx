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
import { useAddBankingTransaction } from '@/hooks/use-api';
import { useState } from 'react';

interface AddBalanceDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
}

export function AddBalanceDialog({
	open,
	onOpenChange,
	onSuccess,
}: AddBalanceDialogProps) {
	const addTransaction = useAddBankingTransaction();
	const [amount, setAmount] = useState<string>('');
	const [description, setDescription] = useState<string>('');

	const handleSave = () => {
		const num = parseFloat(amount);
		if (isNaN(num)) return;

		addTransaction.mutate(
			{ amount: num, description },
			{
				onSuccess: () => {
					onSuccess();
					onOpenChange(false);
					setAmount('');
					setDescription('');
				},
			},
		);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[425px] bg-zinc-950 border border-zinc-800 text-zinc-100">
				<DialogHeader>
					<DialogTitle>Add to Balance</DialogTitle>
					<DialogDescription className="text-zinc-400 text-xs">
						Enter the amount to add to (or subtract from) the bot's balance.
						This will be recorded in bankingTransactions.
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-4 py-4">
					<div className="grid gap-2">
						<Label htmlFor="amount" className="text-zinc-300">
							Amount ($)
						</Label>
						<Input
							id="amount"
							type="number"
							placeholder="e.g. 100 or -50"
							value={amount}
							onChange={(e) => setAmount(e.target.value)}
							className="bg-zinc-900 border-zinc-700 text-zinc-100"
						/>
					</div>

					<div className="grid gap-2">
						<Label htmlFor="description" className="text-zinc-300">
							Description (Optional)
						</Label>
						<Input
							id="description"
							placeholder="e.g. Manual top-up"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
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
						className="bg-emerald-600 hover:bg-emerald-700 text-white"
						disabled={addTransaction.isPending || !amount}
						onClick={handleSave}
					>
						{addTransaction.isPending
							? '⌛ Saving...'
							: 'Add to Balance'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
