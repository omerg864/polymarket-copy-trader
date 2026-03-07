import type { BotConfig, TradeSummary } from '@polymarket-bot/shared';
import type { Request, Response } from 'express';
import config from '../config';
import {
	flushRedis,
	getActiveTrades,
	getBotBalance,
	getBotStartTime,
	getBotStats,
	getRedisInfo,
	getStopRequested,
	getTradeHistory,
	setStopRequested,
} from '../services/redis';

export async function getSummary(_req: Request, res: Response): Promise<void> {
	const [stats, balance, activeTrades, botStartTime, isStopping] =
		await Promise.all([
			getBotStats(),
			getBotBalance(),
			getActiveTrades(),
			getBotStartTime(),
			getStopRequested(),
		]);

	const summary: TradeSummary = {
		balance,
		initialBalance: config.botAllowance,
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

export function getBotConfig(_req: Request, res: Response): void {
	const botConfig: BotConfig = {
		mode: config.mode,
		minOrderSizeUsd: config.minOrderSizeUsd,
		maxOrderSizeUsd: config.maxOrderSizeUsd,
		confidenceThreshold: config.confidenceThreshold,
		takeProfitPct: config.takeProfitPct,
		stopLossPct: config.stopLossPct,
		maxConcurrentTrades: config.maxConcurrentTrades,
		minEntryPrice: config.minEntryPrice,
		minMarketAgeMinutes: config.minMarketAgeMinutes,
		candleCount: config.candleCount,
		rsiPeriod: config.rsiPeriod,
		emaFast: config.emaFast,
		emaSlow: config.emaSlow,
		riskMonitorIntervalMs: config.riskMonitorIntervalMs,
		botAllowance: config.botAllowance,
		highPriceThreshold: config.highPriceThreshold,
		highPriceMaxBonusPct: config.highPriceMaxBonusPct,
	};

	res.json(botConfig);
}

export async function getRedisStats(
	_req: Request,
	res: Response,
): Promise<void> {
	const stats = await getRedisInfo();
	res.json(stats);
}

export async function flushRedisData(
	_req: Request,
	res: Response,
): Promise<void> {
	await flushRedis();
	res.json({ success: true });
}
