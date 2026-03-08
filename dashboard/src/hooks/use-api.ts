import type { BotConfig, StrategyConfig, Trade, TradeSummary } from '@/types';
import { useMutation, useQuery } from '@tanstack/react-query';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export type AuthRole = 'admin' | 'readonly';

let authPassword: string | null = null;
let authRole: AuthRole | null = null;

export function setAuthPassword(password: string | null) {
	authPassword = password;
	if (!password) authRole = null;
}

export function setAuthRole(role: AuthRole | null) {
	authRole = role;
}

export function getAuthPassword(): string | null {
	return authPassword;
}

export function getAuthRole(): AuthRole | null {
	return authRole;
}

function getAuthHeaders(): Record<string, string> {
	if (!authPassword) return {};
	return { Authorization: `Bearer ${authPassword}` };
}

async function fetchJson<T>(url: string): Promise<T> {
	const res = await fetch(`${API_BASE}${url}`, {
		headers: { ...getAuthHeaders() },
	});
	if (res.status === 401) {
		authPassword = null;
		window.location.reload();
		throw new Error('Unauthorized');
	}
	if (!res.ok) throw new Error(`API error: ${res.statusText}`);
	return res.json();
}

export function useLogin() {
	return useMutation({
		mutationFn: async (password: string) => {
			const res = await fetch(`${API_BASE}/auth/verify`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ password }),
			});
			if (!res.ok) throw new Error('Invalid password');
			const data = await res.json();
			authPassword = password;
			authRole = data.role || 'readonly';
			return data;
		},
	});
}

export function useCheckAuth() {
	return useQuery<boolean>({
		queryKey: ['auth-check'],
		queryFn: async () => {
			if (!authPassword) {
				// Check if auth is even required
				const res = await fetch(`${API_BASE}/auth/verify`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({}),
				});
				if (res.ok) {
					const data = await res.json();
					authPassword = '';
					authRole = data.role || 'admin';
					return true;
				}
				return false;
			}
			const res = await fetch(`${API_BASE}/auth/verify`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ password: authPassword }),
			});
			if (res.ok) {
				const data = await res.json();
				authRole = data.role || 'readonly';
			}
			return res.ok;
		},
		retry: false,
		staleTime: Infinity,
	});
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
				headers: {
					'Content-Type': 'application/json',
					...getAuthHeaders(),
				},
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

export interface MarketPricesData {
	btcPrice: number;
	priceToBeat: number | null;
	updatedAt: number;
	marketTitle: string | null;
}

export function useMarketPrices() {
	return useQuery<MarketPricesData | null>({
		queryKey: ['market-prices'],
		queryFn: () => fetchJson('/market-prices'),
		refetchInterval: 2000,
	});
}

export function useFlushRedis() {
	return useMutation({
		mutationFn: async () => {
			const res = await fetch(`${API_BASE}/flush-redis`, {
				method: 'POST',
				headers: { ...getAuthHeaders() },
			});
			if (!res.ok) throw new Error(`API error: ${res.statusText}`);
			return res.json();
		},
	});
}

export function useUpdateConfig() {
	return useMutation({
		mutationFn: async (updates: Partial<StrategyConfig>) => {
			const res = await fetch(`${API_BASE}/config`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					...getAuthHeaders(),
				},
				body: JSON.stringify(updates),
			});
			if (res.status === 403) throw new Error('Admin access required');
			if (!res.ok) throw new Error(`API error: ${res.statusText}`);
			return res.json() as Promise<StrategyConfig>;
		},
	});
}
