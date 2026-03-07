import { AnalysisDashboard } from '@/components/AnalysisDashboard';
import { Dashboard } from '@/components/Dashboard';
import { LoginPage } from '@/components/LoginPage';
import { setAuthPassword, useCheckAuth } from '@/hooks/use-api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

const queryClient = new QueryClient();

function AuthenticatedApp() {
	const { data: isAuthenticated, isLoading, refetch } = useCheckAuth();
	const [activeTab, setActiveTab] = useState<'live' | 'analysis'>('live');

	if (isLoading) {
		return (
			<div className="min-h-screen bg-zinc-950 flex items-center justify-center">
				<p className="text-zinc-500 animate-pulse">Loading...</p>
			</div>
		);
	}

	if (!isAuthenticated) {
		return <LoginPage onSuccess={() => refetch()} />;
	}

	return (
		<div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
			{/* Top Global Navigation Bar */}
			<header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur sticky top-0 z-50">
				<div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-6">
					<div className="font-semibold text-zinc-100 flex items-center gap-2">
						<span className="text-xl">📈</span>
						<span>Polymarket 5M Bot</span>
					</div>
					<nav className="flex items-center gap-1 ml-4 border-l border-zinc-800 pl-4 h-8 text-sm">
						<button
							onClick={() => setActiveTab('live')}
							className={`px-3 py-1.5 rounded-md transition-colors ${
								activeTab === 'live'
									? 'bg-zinc-800 text-zinc-100 font-medium'
									: 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
							}`}
						>
							🟢 Live Dashboard
						</button>
						<button
							onClick={() => setActiveTab('analysis')}
							className={`px-3 py-1.5 rounded-md transition-colors ${
								activeTab === 'analysis'
									? 'bg-zinc-800 text-zinc-100 font-medium'
									: 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
							}`}
						>
							📊 Trade Analysis
						</button>
					</nav>
					<div className="ml-auto">
						<button
							onClick={() => {
								setAuthPassword(null);
								refetch();
							}}
							className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
						>
							🔓 Logout
						</button>
					</div>
				</div>
			</header>

			{/* Main Content Area */}
			<main className="flex-1">
				{activeTab === 'live' && <Dashboard />}
				{activeTab === 'analysis' && <AnalysisDashboard />}
			</main>
		</div>
	);
}

export default function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<AuthenticatedApp />
		</QueryClientProvider>
	);
}
