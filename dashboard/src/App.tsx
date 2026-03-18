import pkg from '../package.json';
import { AnalysisDashboard } from '@/components/AnalysisDashboard';
import { Dashboard } from '@/components/Dashboard';
import { LoginPage } from '@/components/LoginPage';
import { Badge } from '@/components/ui/badge';
import {
	getAuthRole,
	setAuthPassword,
	useCheckAuth,
	useConfig,
} from '@/hooks/use-api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

const queryClient = new QueryClient();

function AuthenticatedApp() {
	const { data: isAuthenticated, isLoading, refetch } = useCheckAuth();
	const { data: config } = useConfig({ enabled: !!isAuthenticated });
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
				<div className="max-w-7xl mx-auto px-4 sm:px-6">
					<div className="flex h-14 items-center justify-between gap-4">
						{/* Logo Area */}
						<div className="flex items-center gap-2 flex-shrink-0">
							<span className="text-xl">📈</span>
							<span className="font-semibold text-zinc-100 hidden xs:inline">
								Polymarket 5M Bot
							</span>
							<span className="font-semibold text-zinc-100 xs:hidden">
								Polymarket 5M Bot
							</span>
							<span className="text-[10px] text-zinc-500 font-mono self-end mb-0.5">
								v{pkg.version}
							</span>
						</div>

						{/* Desktop Nav */}
						<nav className="hidden md:flex items-center gap-1 border-l border-zinc-800 pl-4 h-8 text-sm">
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

						{/* Right side: Indicators & Logout */}
						<div className="flex items-center gap-2 sm:gap-3 ml-auto">
							<div className="hidden sm:flex items-center gap-2">
								{getAuthRole() === 'readonly' && (
									<span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
										READ-ONLY
									</span>
								)}
								{getAuthRole() === 'admin' && (
									<span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
										ADMIN
									</span>
								)}
								{config?.mode && (
									<Badge
										variant="outline"
										className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full border ${
											config.mode === 'prod'
												? 'bg-red-500/10 text-red-400 border-red-500/30'
												: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30'
										}`}
									>
										{config.mode}
									</Badge>
								)}
							</div>
							<button
								onClick={() => {
									setAuthPassword(null);
									refetch();
								}}
								className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1.5 px-2 py-1 hover:bg-zinc-800/50 rounded"
							>
								<span className="hidden xs:inline">Logout</span>
								<span>🔓</span>
							</button>
						</div>
					</div>

					{/* Mobile/Tablet Nav & Sub-Header (shown only on smaller screens) */}
					<div className="flex md:hidden items-center justify-between py-2 border-t border-zinc-800/50 gap-2">
						<nav className="flex items-center gap-1 text-[11px] xs:text-xs">
							<button
								onClick={() => setActiveTab('live')}
								className={`px-2 py-1 rounded transition-colors ${
									activeTab === 'live'
										? 'bg-zinc-800 text-zinc-100 font-medium'
										: 'text-zinc-400'
								}`}
							>
								🟢 Live
							</button>
							<button
								onClick={() => setActiveTab('analysis')}
								className={`px-2 py-1 rounded transition-colors ${
									activeTab === 'analysis'
										? 'bg-zinc-800 text-zinc-100 font-medium'
										: 'text-zinc-400'
								}`}
							>
								📊 Analysis
							</button>
						</nav>

						<div className="flex sm:hidden items-center gap-1.5">
							{getAuthRole() === 'readonly' && (
								<span className="text-[8px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
									RO
								</span>
							)}
							{getAuthRole() === 'admin' && (
								<span className="text-[8px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
									AD
								</span>
							)}
							{config?.mode && (
								<Badge
									variant="outline"
									className={`text-[8px] uppercase font-bold px-1.5 py-0.5 rounded-full border ${
										config.mode === 'prod'
											? 'bg-red-500/10 text-red-400 border-red-500/30'
											: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30'
									}`}
								>
									{config.mode}
								</Badge>
							)}
						</div>
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
