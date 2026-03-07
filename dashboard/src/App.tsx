import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dashboard } from '@/components/Dashboard';
import { AnalysisDashboard } from '@/components/AnalysisDashboard';

const queryClient = new QueryClient();

export default function App() {
	const [activeTab, setActiveTab] = useState<'live' | 'analysis'>('live');

	return (
		<QueryClientProvider client={queryClient}>
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
					</div>
				</header>

				{/* Main Content Area */}
				<main className="flex-1">
					{activeTab === 'live' && <Dashboard />}
					{activeTab === 'analysis' && <AnalysisDashboard />}
				</main>
			</div>
		</QueryClientProvider>
	);
}
