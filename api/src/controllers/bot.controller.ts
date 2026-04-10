import type { Request, Response } from 'express';
import type {
	BotVersions,
	StrategyConfig,
	TradeSummary,
} from '../../../shared/src/types';
import config from '../config';
import { resolveRole } from '../middleware/auth';
import { DateTime } from 'luxon';
import {
	clearModeData,
	getActiveTrades,
	getBotBalance,
	getBotStartTime,
	getBotStats,
	getBotVersion,
	getDailyStats,
	getMarketPrices,
	getRedisInfo,
	getStopRequested,
	setBotStartTime,
	setStopRequested,
} from '../services/redis';
import { tradeService } from '../services/tradeService';
import {
	getStrategyConfig,
	updateStrategyConfig,
} from '../services/strategyConfig';
import pkg from '../../package.json';

export async function getSummary(_req: Request, res: Response): Promise<void> {
	const strategyConfig = await getStrategyConfig();
	const timezone = strategyConfig.timezone || 'Asia/Jerusalem';
	const todayStr = DateTime.now().setZone(timezone).toISODate() || '';

	const [stats, activeTrades, botStartTime, isStopping, dailyStats] =
		await Promise.all([
			getBotStats(),
			getActiveTrades(),
			getBotStartTime(),
			getStopRequested(),
			getDailyStats(todayStr),
		]);

	const balance = await getBotBalance(strategyConfig);

	const summary: TradeSummary = {
		balance,
		initialBalance: strategyConfig.botAllowance,
		totalPnl: stats.totalPnl,
		todayPnl: dailyStats.pnl,
		todayWins: dailyStats.wins,
		todayLosses: dailyStats.losses,
		todayTrades: dailyStats.wins + dailyStats.losses,
		totalFees: stats.totalFees,
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
	const limitStr = req.query.limit as string;
	const limit = limitStr ? parseInt(limitStr, 10) : undefined;
	const trades = await tradeService.getTradeHistory(limit);
	res.json(trades);
}

export async function stopBot(req: Request, res: Response): Promise<void> {
	const { stop } = req.body as { stop?: boolean };
	await setStopRequested(!!stop);
	res.json({ success: true, isStopping: !!stop });
}

export async function updateBotStartTime(
	req: Request,
	res: Response,
): Promise<void> {
	const { startTime } = req.body as { startTime?: number };
	if (!startTime || typeof startTime !== 'number') {
		res.status(400).json({ error: 'startTime is required and must be a number' });
		return;
	}
	await setBotStartTime(startTime);
	res.json({ success: true, botStartTime: startTime });
}

export async function getBotConfig(
	_req: Request,
	res: Response,
): Promise<void> {
	const strategy = await getStrategyConfig();
	res.json({ mode: config.mode, ...strategy });
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

export async function getMongoStats(
	_req: Request,
	res: Response,
): Promise<void> {
	const stats = await tradeService.getMongoStats();
	res.json(stats);
}

export async function getMarketPricesData(
	_req: Request,
	res: Response,
): Promise<void> {
	const data = await getMarketPrices();
	res.json(data);
}

export async function resetBotData(
	_req: Request,
	res: Response,
): Promise<void> {
	const isDemo = config.isDemo;
	const mode = isDemo ? 'demo' : 'live';

	try {
		await Promise.all([
			tradeService.clearAllTrades(mode),
			clearModeData(mode),
		]);
		res.json({ success: true, mode });
	} catch (error) {
		console.error(`Failed to reset bot data: ${error}`);
		res.status(500).json({ error: 'Failed to reset bot data' });
	}
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

export function getTimezones(_req: Request, res: Response): void {
	try {
		// Use standard Intl API to get all supported IANA timezones
		const timezones = (Intl as any).supportedValuesOf('timeZone');
		res.json(timezones);
	} catch (error) {
		// Fallback for older Node versions if necessary, though 18+ should have it
		res.json([
			'Asia/Jerusalem',
			'America/New_York',
			'UTC',
			'Europe/London',
		]);
	}
}

export async function getVersions(_req: Request, res: Response): Promise<void> {
	try {
		const bot = await getBotVersion();
		res.json({
			bot: bot ?? null,
			api: pkg.version,
		} satisfies BotVersions);
	} catch (error) {
		res.status(500).json({ error: 'Failed to fetch versions' });
	}
}
