import type { Request, Response } from 'express';
import type {
	BotConfig,
	StrategyConfig,
	TradeSummary,
} from '../../../shared/src/types';
import config from '../config';
import { resolveRole } from '../middleware/auth';
import {
	flushRedis,
	getActiveTrades,
	getBotBalance,
	getBotStartTime,
	getBotStats,
	getMarketPrices,
	getRedisInfo,
	getStopRequested,
	getTradeHistory,
	setStopRequested,
} from '../services/redis';
import {
	getStrategyConfig,
	updateStrategyConfig,
} from '../services/strategyConfig';

export async function getSummary(_req: Request, res: Response): Promise<void> {
	const [
		stats,
		balance,
		activeTrades,
		botStartTime,
		isStopping,
		strategyConfig,
	] = await Promise.all([
		getBotStats(),
		getBotBalance(),
		getActiveTrades(),
		getBotStartTime(),
		getStopRequested(),
		getStrategyConfig(),
	]);

	const summary: TradeSummary = {
		balance,
		initialBalance: strategyConfig.botAllowance,
		totalPnl: stats.totalPnl,
		totalTrades: stats.totalTrades,
		wins: stats.wins,
		losses: stats.losses,
		winRate:
			stats.totalTrades > 0
				? ((stats.wins / stats.totalTrades) * 100).toFixed(1)
				: '0.0',
		activeTrades: activeTrades.length,
		isStopping,
		botStartTime,
	};

	res.json(summary);
}

export async function listActiveTrades(
	_req: Request,
	res: Response,
): Promise<void> {
	const trades = await getActiveTrades();
	res.json(trades);
}

export async function listTradeHistory(
	req: Request,
	res: Response,
): Promise<void> {
	const limit = parseInt((req.query.limit as string) || '100', 10);
	const trades = await getTradeHistory(limit);
	res.json(trades);
}

export async function stopBot(req: Request, res: Response): Promise<void> {
	const { stop } = req.body as { stop?: boolean };
	await setStopRequested(!!stop);
	res.json({ success: true, isStopping: !!stop });
}

export async function getBotConfig(
	_req: Request,
	res: Response,
): Promise<void> {
	const strategy = await getStrategyConfig();
	const botConfig: BotConfig = {
		mode: config.mode,
		...strategy,
	};
	res.json(botConfig);
}

export async function updateConfig(req: Request, res: Response): Promise<void> {
	const updates = req.body as Partial<StrategyConfig>;
	const updated = await updateStrategyConfig(updates);
	res.json(updated);
}

export async function getRedisStats(
	_req: Request,
	res: Response,
): Promise<void> {
	const stats = await getRedisInfo();
	res.json(stats);
}

export async function getMarketPricesData(
	_req: Request,
	res: Response,
): Promise<void> {
	const data = await getMarketPrices();
	res.json(data);
}

export async function flushRedisData(
	_req: Request,
	res: Response,
): Promise<void> {
	await flushRedis();
	res.json({ success: true });
}

export function verifyAuth(req: Request, res: Response): void {
	const { password } = req.body as { password?: string };
	if (!config.adminPassword && !config.readonlyPassword) {
		res.json({ success: true, role: 'admin' });
		return;
	}
	if (!password) {
		res.status(401).json({ error: 'Authentication required' });
		return;
	}
	const role = resolveRole(password);
	if (role) {
		res.json({ success: true, role });
		return;
	}
	res.status(401).json({ error: 'Invalid password' });
}
