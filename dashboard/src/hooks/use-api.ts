import type {
	NotificationConfig,
	RedisInfo,
	StrategyConfig,
	Trade,
	TradeSummary,
	MarketDashboardData,
	PriceCandle,
	BotVersions,
	MongoInfo,
	VerificationResult,
} from '@shared/types';
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

export function useConfig(options: { enabled?: boolean } = {}) {
	return useQuery<StrategyConfig>({
		queryKey: ['config'],
		queryFn: () => fetchJson('/config'),
		refetchInterval: 30000,
		...options,
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
	return useQuery<RedisInfo>({
		queryKey: ['redis-stats'],
		queryFn: () => fetchJson('/redis-stats'),
		refetchInterval: 10000,
	});
}

export function useMongoStats() {
	return useQuery<MongoInfo>({
		queryKey: ['mongo-stats'],
		queryFn: () => fetchJson('/mongo-stats'),
		refetchInterval: 30000,
	});
}

export function useMarketPrices() {
	return useQuery<MarketDashboardData | null>({
		queryKey: ['market-prices'],
		queryFn: () => fetchJson('/market-prices'),
		refetchInterval: 2000,
	});
}

export function useResetBot() {
	return useMutation({
		mutationFn: async () => {
			const res = await fetch(`${API_BASE}/reset-bot`, {
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

export function useUpdateBotStartTime() {
	return useMutation({
		mutationFn: async (startTime: number) => {
			const res = await fetch(`${API_BASE}/bot-start-time`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...getAuthHeaders(),
				},
				body: JSON.stringify({ startTime }),
			});
			if (res.status === 403) throw new Error('Admin access required');
			if (!res.ok) throw new Error(`API error: ${res.statusText}`);
			return res.json();
		},
	});
}

export function useVerifyStats() {
	return useMutation({
		mutationFn: async (fix: boolean) => {
			const res = await fetch(`${API_BASE}/verify-stats`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...getAuthHeaders(),
				},
				body: JSON.stringify({ fix }),
			});
			if (res.status === 403) throw new Error('Admin access required');
			if (!res.ok) throw new Error(`API error: ${res.statusText}`);
			return res.json() as Promise<VerificationResult>;
		},
	});
}


export function useNotificationConfig() {
	return useQuery<NotificationConfig>({
		queryKey: ['notification-config'],
		queryFn: () => fetchJson('/notifications'),
		refetchInterval: 30000,
	});
}

export function useUpdateNotificationConfig() {
	return useMutation({
		mutationFn: async (updates: Partial<NotificationConfig>) => {
			const res = await fetch(`${API_BASE}/notifications`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					...getAuthHeaders(),
				},
				body: JSON.stringify(updates),
			});
			if (res.status === 403) throw new Error('Admin access required');
			if (!res.ok) throw new Error(`API error: ${res.statusText}`);
			return res.json() as Promise<NotificationConfig>;
		},
	});
}

export function useTimezones() {
	return useQuery<string[]>({
		queryKey: ['timezones'],
		queryFn: () => fetchJson('/timezones'),
		staleTime: Infinity, // Timezones don't change often
	});
}

export function useCandles(params: {
	startTime?: string;
	endTime?: string;
	interval?: string;
	enabled?: boolean;
}) {
	return useQuery<PriceCandle[]>({
		queryKey: ['candles', params],
		queryFn: () => {
			const query = new URLSearchParams();
			if (params.startTime) query.append('startTime', params.startTime);
			if (params.endTime) query.append('endTime', params.endTime);
			if (params.interval) query.append('interval', params.interval);
			return fetchJson(`/prices/candles?${query.toString()}`);
		},
		enabled: params.enabled !== false,
		staleTime: 60000, // 1 minute cache
	});
}

export function useVersions(options: { enabled?: boolean } = {}) {
	return useQuery<BotVersions>({
		queryKey: ['versions'],
		queryFn: () => fetchJson('/versions'),
		refetchInterval: 30000,
		...options,
	});
}
