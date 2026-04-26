import { AnalysisDashboard } from '@/components/AnalysisDashboard';
import { TradeType } from '@shared/types';
import { Dashboard } from '@/components/Dashboard';
import { LoginPage } from '@/components/LoginPage';
import { Simulations } from '@/components/Simulations';
import { VersionBadge } from '@/components/shared/VersionBadge';
import {
	getAuthRole,
	getMode,
	setAuthPassword,
	setMode,
	useCheckAuth,
} from '@/hooks/use-api';
import {
	QueryClient,
	QueryClientProvider,
	useQueryClient,
} from '@tanstack/react-query';
import { useState } from 'react';

const queryClient = new QueryClient();

function AuthenticatedApp() {
	const queryClient = useQueryClient();
	const { data: isAuthenticated, isLoading, refetch } = useCheckAuth();
	const [activeTab, setActiveTab] = useState<
		'live' | 'analysis' | 'simulations'
	>('live');
	const [mode, setCurrentMode] = useState<TradeType>(getMode());

	const handleModeSwitch = (newMode: TradeType) => {
		setMode(newMode);
		setCurrentMode(newMode);
		queryClient.invalidateQueries();
	};

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
						<div className="flex items-center gap-1.5 flex-shrink-0">
							<span className="text-lg sm:text-xl">📈</span>
							<span className="font-semibold text-zinc-100 text-sm sm:text-base whitespace-nowrap">
								Polymarket 5M Bot
							</span>
							<div className="hidden sm:block self-end mb-0.5">
								<VersionBadge />
							</div>
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
							<button
								onClick={() => setActiveTab('simulations')}
								className={`px-3 py-1.5 rounded-md transition-colors ${
									activeTab === 'simulations'
										? 'bg-zinc-800 text-zinc-100 font-medium'
										: 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
								}`}
							>
								🧪 Simulations
							</button>
						</nav>

						{/* Right side: Indicators & Mode Switcher & Logout */}
						<div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3 ml-auto">
							{/* Mode Switcher (Desktop) */}
							<div className="hidden sm:flex items-center bg-zinc-950 rounded-lg p-0.5 border border-zinc-800">
								<button
									onClick={() =>
										handleModeSwitch(TradeType.DEMO)
									}
									className={`text-[9px] xs:text-[10px] uppercase font-bold px-2 xs:px-3 py-1 rounded-md transition-all ${
										mode === TradeType.DEMO
											? 'bg-zinc-800 text-zinc-100 shadow-sm'
											: 'text-zinc-500 hover:text-zinc-300'
									}`}
								>
									Demo
								</button>
								<button
									onClick={() =>
										handleModeSwitch(TradeType.TEST)
									}
									className={`text-[9px] xs:text-[10px] uppercase font-bold px-2 xs:px-3 py-1 rounded-md transition-all ${
										mode === TradeType.TEST
											? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
											: 'text-zinc-500 hover:text-zinc-300'
									}`}
								>
									Test
								</button>
								<button
									onClick={() =>
										handleModeSwitch(TradeType.LIVE)
									}
									className={`text-[9px] xs:text-[10px] uppercase font-bold px-2 xs:px-3 py-1 rounded-md transition-all ${
										mode === TradeType.LIVE
											? 'bg-red-500 text-white shadow-sm shadow-red-500/20'
											: 'text-zinc-500 hover:text-zinc-300'
									}`}
								>
									Live
								</button>
							</div>

							<div className="flex items-center gap-2">
								{getAuthRole() === 'readonly' && (
									<span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
										<span className="hidden sm:inline">READ-ONLY</span>
										<span className="sm:hidden">RO</span>
									</span>
								)}
								{getAuthRole() === 'admin' && (
									<span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
										<span className="hidden sm:inline">ADMIN</span>
										<span className="sm:hidden">AD</span>
									</span>
								)}
							</div>
							<button
								onClick={() => {
									setAuthPassword(null);
									refetch();
								}}
								className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1 px-1 xs:gap-1.5 xs:px-2 py-1 hover:bg-zinc-800/50 rounded"
							>
								<span className="hidden xs:inline">Logout</span>
								<span>🔓</span>
							</button>
						</div>
					</div>

					{/* Mobile/Tablet Nav Area (shown only on smaller screens) */}
					<div className="md:hidden flex flex-col py-2 border-t border-zinc-800/50 gap-2">
						{/* Mode Switcher Row (Mobile only) */}
						<div className="sm:hidden flex items-center justify-center bg-zinc-950 rounded-lg p-0.5 border border-zinc-800 self-start">
							<button
								onClick={() =>
									handleModeSwitch(TradeType.DEMO)
								}
								className={`text-[9px] uppercase font-bold px-3 py-1 rounded transition-all flex-1 text-center min-w-[60px] ${
									mode === TradeType.DEMO
										? 'bg-zinc-800 text-zinc-100'
										: 'text-zinc-500'
								}`}
							>
								Demo
							</button>
							<button
								onClick={() =>
									handleModeSwitch(TradeType.TEST)
								}
								className={`text-[9px] uppercase font-bold px-3 py-1 rounded transition-all flex-1 text-center min-w-[60px] ${
									mode === TradeType.TEST
										? 'bg-blue-600 text-white'
										: 'text-zinc-500'
								}`}
							>
								Test
							</button>
							<button
								onClick={() =>
									handleModeSwitch(TradeType.LIVE)
								}
								className={`text-[9px] uppercase font-bold px-3 py-1 rounded transition-all flex-1 text-center min-w-[60px] ${
									mode === TradeType.LIVE
										? 'bg-red-500 text-white'
										: 'text-zinc-500'
								}`}
							>
								Live
							</button>
						</div>

						{/* Separator */}
						<div className="sm:hidden border-t border-zinc-800/50 my-0.5" />

						{/* Tabs Row (Lowest row) */}
						<div className="flex items-center">
							<nav className="flex items-center gap-1 text-[11px] xs:text-xs overflow-x-auto pb-1 scrollbar-hide">
								<button
									onClick={() => setActiveTab('live')}
									className={`px-2 py-1 rounded transition-colors whitespace-nowrap flex-shrink-0 ${
										activeTab === 'live'
											? 'bg-zinc-800 text-zinc-100 font-medium'
											: 'text-zinc-400'
									}`}
								>
									🟢 Live Dashboard
								</button>
								<button
									onClick={() => setActiveTab('analysis')}
									className={`px-2 py-1 rounded transition-colors whitespace-nowrap flex-shrink-0 ${
										activeTab === 'analysis'
											? 'bg-zinc-800 text-zinc-100 font-medium'
											: 'text-zinc-400'
									}`}
								>
									📊 Trade Analysis
								</button>
								<button
									onClick={() => setActiveTab('simulations')}
									className={`px-2 py-1 rounded transition-colors whitespace-nowrap flex-shrink-0 ${
										activeTab === 'simulations'
											? 'bg-zinc-800 text-zinc-100 font-medium'
											: 'text-zinc-400'
									}`}
								>
									🧪 Simulations
								</button>
							</nav>
						</div>
					</div>
				</div>
			</header>

			{/* Main Content Area */}
			<main className="flex-1">
				{activeTab === 'live' && <Dashboard />}
				{activeTab === 'analysis' && <AnalysisDashboard />}
				{activeTab === 'simulations' && (
					<div className="min-h-[calc(100vh-3.5rem)] bg-zinc-950 text-zinc-100 p-3 sm:p-6">
						<div className="max-w-7xl mx-auto">
							<Simulations />
						</div>
					</div>
				)}
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
