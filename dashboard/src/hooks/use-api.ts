import type { BotConfig, Trade, TradeSummary } from '@/types';
import { useMutation, useQuery } from '@tanstack/react-query';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function fetchJson<T>(url: string): Promise<T> {
	const res = await fetch(`${API_BASE}${url}`);
	if (!res.ok) throw new Error(`API error: ${res.statusText}`);
	return res.json();
}

export function useConfig() {
	return useQuery<BotConfig>({
		queryKey: ['config'],
		queryFn: () => fetchJson('/config'),
		refetchInterval: 30000,
	});
}

export function useSummary() {
	return useQuery<TradeSummary>({
		queryKey: ['summary'],
		queryFn: () => fetchJson('/summary'),
		refetchInterval: 5000,
	});
}

export function useActiveTrades() {
	return useQuery<Trade[]>({
		queryKey: ['active-trades'],
		queryFn: () => fetchJson('/active-trades'),
		refetchInterval: 5000,
	});
}

export function useTradeHistory() {
	return useQuery<Trade[]>({
		queryKey: ['trade-history'],
		queryFn: () => fetchJson('/trade-history'),
		refetchInterval: 10000,
	});
}

export function useToggleStop() {
	return useMutation({
		mutationFn: async (stop: boolean) => {
			const res = await fetch(`${API_BASE}/stop`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ stop }),
			});
			if (!res.ok) throw new Error(`API error: ${res.statusText}`);
			return res.json();
		},
	});
}

export function useRedisStats() {
	return useQuery<{ memoryUsed: string; totalKeys: number }>({
		queryKey: ['redis-stats'],
		queryFn: () => fetchJson('/redis-stats'),
		refetchInterval: 10000,
	});
}

export function useFlushRedis() {
	return useMutation({
		mutationFn: async () => {
			const res = await fetch(`${API_BASE}/flush-redis`, {
				method: 'POST',
			});
			if (!res.ok) throw new Error(`API error: ${res.statusText}`);
			return res.json();
		},
	});
}
