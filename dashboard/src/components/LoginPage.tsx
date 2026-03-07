import { Button } from '@/components/ui/button';
import { useLogin } from '@/hooks/use-api';
import { useState } from 'react';

interface LoginPageProps {
	onSuccess: () => void;
}

export function LoginPage({ onSuccess }: LoginPageProps) {
	const [password, setPassword] = useState('');
	const login = useLogin();

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		login.mutate(password, {
			onSuccess: () => onSuccess(),
		});
	};

	return (
		<div className="min-h-screen bg-zinc-950 flex items-center justify-center">
			<form
				onSubmit={handleSubmit}
				className="w-full max-w-sm space-y-6 p-8 rounded-xl border border-zinc-800 bg-zinc-900/50"
			>
				<div className="text-center space-y-2">
					<h1 className="text-2xl font-bold text-zinc-100">
						🔒 Dashboard Login
					</h1>
					<p className="text-sm text-zinc-500">
						Enter the password to access the dashboard
					</p>
				</div>
				<div className="space-y-2">
					<input
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder="Password"
						autoFocus
						className="w-full px-3 py-2 rounded-md border border-zinc-700 bg-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					/>
				</div>
				{login.isError && (
					<p className="text-sm text-red-400 text-center">
						Invalid password. Please try again.
					</p>
				)}
				<Button
					type="submit"
					disabled={login.isPending || !password}
					className="w-full bg-blue-600 hover:bg-blue-700 text-white"
				>
					{login.isPending ? 'Verifying...' : 'Login'}
				</Button>
			</form>
		</div>
	);
}
