import { randomUUID } from 'crypto';
import config from '../config.js';
import redisService from './redis.js';
import logger from '../utils/logger.js';

/**
 * Demo trading service — simulates order placement and P&L tracking
 * without using real money. Uses the same interface as real trading
 * so the strategy engine can swap seamlessly.
 */
class DemoTradingService {
	constructor() {
		this.balance = config.botAllowance;
	}

	async initialize() {
		this.balance = await redisService.getBotBalance();
		if (
			isNaN(this.balance) ||
			this.balance === null ||
			this.balance === undefined
		) {
			this.balance = config.botAllowance;
			await redisService.setBotBalance(this.balance);
		}
		logger.info(
			`🎮 Demo trading initialized | Balance: $${this.balance.toFixed(2)} USDC`,
		);
	}

	async getBalance() {
		this.balance = await redisService.getBotBalance();
		return this.balance;
	}

	/**
	 * Simulate buying a position
	 */
	async placeBuyOrder(
		tokenId,
		price,
		size,
		market,
		direction,
		confidence = 0,
	) {
		// Validate price before trading
		if (
			!price ||
			price <= 0 ||
			!isFinite(price) ||
			!isFinite(size) ||
			size <= 0
		) {
			logger.warn(
				`Invalid trade params: price=${price}, size=${size}. Skipping.`,
			);
			return null;
		}

		this.balance = await redisService.getBotBalance();
		const cost = price * size;

		if (isNaN(cost) || cost > this.balance) {
			logger.warn(
				`Insufficient demo balance: $${this.balance.toFixed(2)} < $${cost.toFixed(2)}`,
			);
			return null;
		}

		// Deduct cost from balance
		this.balance -= cost;
		await redisService.setBotBalance(this.balance);

		const trade = {
			id: randomUUID(),
			type: 'demo',
			direction,
			tokenId,
			conditionId: market.conditionId,
			slug: market.slug,
			eventTicker: market.eventTicker,
			title: market.title,
			side: 'BUY',
			entryPrice: price,
			currentPrice: price,
			size,
			cost,
			status: 'open',
			startTime: market.startTime.toISOString(),
			endTime: market.endTime.toISOString(),
			enteredAt: new Date().toISOString(),
			priceToBeat: market.priceToBeat,
			confidence,
			pnl: 0,
		};

		await redisService.saveTrade(trade);

		logger.trade('📝 DEMO BUY', {
			direction,
			price: price.toFixed(3),
			size,
			cost: `$${cost.toFixed(2)}`,
			balance: `$${this.balance.toFixed(2)}`,
			market: market.title,
		});

		return trade;
	}

	/**
	 * Simulate selling a position (take profit or stop loss)
	 */
	async placeSellOrder(trade, currentPrice, reason = 'sell') {
		const revenue = currentPrice * trade.size;
		const pnl = revenue - trade.cost;
		const pctChange =
			trade.entryPrice > 0
				? (currentPrice - trade.entryPrice) / trade.entryPrice
				: 0;

		// Add revenue back to balance
		this.balance = await redisService.getBotBalance();
		this.balance += revenue;
		await redisService.setBotBalance(this.balance);

		// Update trade
		trade.status =
			reason === 'tp'
				? 'closed_tp'
				: reason === 'sl'
					? 'closed_sl'
					: 'closed_sell';
		trade.exitPrice = currentPrice;
		trade.pnl = pnl;
		trade.pctChange = pctChange;
		trade.closedAt = new Date().toISOString();

		await redisService.removeTrade(trade.id);
		await redisService.saveTradeHistory(trade);

		// Update stats
		const stats = await redisService.getBotStats();
		stats.totalTrades += 1;
		if (pnl >= 0) stats.wins += 1;
		else stats.losses += 1;
		stats.totalPnl += pnl;
		await redisService.updateBotStats(stats);

		const logLabel = pctChange >= 0 ? '🟢 TAKE PROFIT' : '🔴 STOP LOSS';
		logger.trade(`📝 DEMO SELL - ${logLabel}`, {
			direction: trade.direction,
			entry: trade.entryPrice.toFixed(3),
			exit: currentPrice.toFixed(3),
			pnl: `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`,
			change: `${(pctChange * 100).toFixed(1)}%`,
			balance: `$${this.balance.toFixed(2)}`,
		});

		logger.profit(pnl, pctChange);

		return trade;
	}

	/**
	 * Resolve a trade at market close (simulate final resolution)
	 */
	async resolveTrade(trade, won) {
		const finalPrice = won ? 1.0 : 0.0;
		const revenue = finalPrice * trade.size;
		const pnl = revenue - trade.cost;
		const pctChange =
			trade.entryPrice > 0
				? (finalPrice - trade.entryPrice) / trade.entryPrice
				: 0;

		this.balance = await redisService.getBotBalance();
		this.balance += revenue;
		await redisService.setBotBalance(this.balance);

		trade.status = won ? 'won' : 'lost';
		trade.exitPrice = finalPrice;
		trade.pnl = pnl;
		trade.pctChange = pctChange;
		trade.closedAt = new Date().toISOString();

		await redisService.removeTrade(trade.id);
		await redisService.saveTradeHistory(trade);

		const stats = await redisService.getBotStats();
		stats.totalTrades += 1;
		if (pnl >= 0) stats.wins += 1;
		else stats.losses += 1;
		stats.totalPnl += pnl;
		await redisService.updateBotStats(stats);

		const emoji = won ? '🏆' : '❌';
		logger.trade(`${emoji} DEMO RESOLVED - ${trade.status.toUpperCase()}`, {
			direction: trade.direction,
			entry: trade.entryPrice.toFixed(3),
			pnl: `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`,
			balance: `$${this.balance.toFixed(2)}`,
		});

		logger.profit(pnl, pctChange);
		return trade;
	}

	async printStats() {
		const stats = await redisService.getBotStats();
		const balance = await redisService.getBotBalance();
		const winRate =
			stats.totalTrades > 0
				? ((stats.wins / stats.totalTrades) * 100).toFixed(1)
				: '0.0';

		logger.info('═══════════════════════════════════════');
		logger.info('📊 DEMO TRADING STATS');
		logger.info(`   Balance:      $${balance.toFixed(2)} USDC`);
		logger.info(`   Total Trades: ${stats.totalTrades}`);
		logger.info(`   Wins:         ${stats.wins} | Losses: ${stats.losses}`);
		logger.info(`   Win Rate:     ${winRate}%`);
		logger.info(
			`   Total P&L:    ${stats.totalPnl >= 0 ? '+' : ''}$${stats.totalPnl.toFixed(2)}`,
		);
		logger.info('═══════════════════════════════════════');
	}
}

const demoTradingService = new DemoTradingService();
export default demoTradingService;
