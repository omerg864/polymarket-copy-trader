import express from 'express';
import cors from 'cors';
import Redis from 'ioredis';
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json());

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const PREFIX = 'pmbot:';

redis.on('error', (err) => console.error('Redis error:', err.message));

// --- Helpers ---
async function getActiveTrades() {
	const ids = await redis.smembers(`${PREFIX}active_trades`);
	if (ids.length === 0) return [];
	const trades = await Promise.all(
		ids.map(async (id) => {
			const data = await redis.get(`${PREFIX}trade:${id}`);
			return data ? JSON.parse(data) : null;
		}),
	);
	return trades.filter(Boolean);
}

async function getTradeHistory(limit = 100) {
	const records = await redis.lrange(`${PREFIX}history`, 0, limit - 1);
	return records.map((r) => JSON.parse(r));
}

async function getBotStats() {
	const raw = await redis.get(
		`${PREFIX}${process.env.MODE === 'live' ? 'live' : 'demo'}:stats`,
	);
	return raw
		? JSON.parse(raw)
		: { totalTrades: 0, wins: 0, losses: 0, totalPnl: 0 };
}

async function getBotBalance() {
	const raw = await redis.get(
		`${PREFIX}${process.env.MODE === 'live' ? 'live' : 'demo'}:balance`,
	);
	const botAllowance = parseFloat(process.env.BOT_ALLOWANCE || '100');
	return raw ? parseFloat(raw) : botAllowance;
}

// --- Routes ---

app.get('/api/summary', async (_req, res) => {
	try {
		const [stats, balance, activeTrades] = await Promise.all([
			getBotStats(),
			getBotBalance(),
			getActiveTrades(),
		]);
		const botAllowance = parseFloat(process.env.BOT_ALLOWANCE || '100');
		res.json({
			balance,
			initialBalance: botAllowance,
			totalPnl: stats.totalPnl,
			totalTrades: stats.totalTrades,
			wins: stats.wins,
			losses: stats.losses,
			winRate:
				stats.totalTrades > 0
					? ((stats.wins / stats.totalTrades) * 100).toFixed(1)
					: '0.0',
			activeTrades: activeTrades.length,
			isStopping:
				(await redis.get(`${PREFIX}state:stop_requested`)) === 'true',
		});
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

app.get('/api/active-trades', async (_req, res) => {
	try {
		const trades = await getActiveTrades();
		res.json(trades);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

app.get('/api/trade-history', async (req, res) => {
	try {
		const limit = parseInt(req.query.limit || '100', 10);
		const trades = await getTradeHistory(limit);
		res.json(trades);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

app.post('/api/stop', async (req, res) => {
	try {
		const { stop } = req.body;
		await redis.set(
			`${PREFIX}state:stop_requested`,
			stop ? 'true' : 'false',
		);
		res.json({ success: true, isStopping: !!stop });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

import config from './config.js';

app.get('/api/config', (_req, res) => {
	try {
		res.json({
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
		});
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
	console.log(`📊 Dashboard API running on http://localhost:${PORT}`);
});
