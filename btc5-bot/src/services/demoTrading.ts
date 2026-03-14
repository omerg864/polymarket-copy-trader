import {
	DEFAULT_STRATEGY_CONFIG,
	TradeStatus,
	TradeType,
	calculateFee,
	type Market,
	type Trade,
} from '@shared/types';
import { randomUUID } from 'crypto';
import logger from '../utils/logger';
import redisService from './redis';
import { getStrategyConfig } from './strategyConfig';

/**
 * Demo trading service — simulates order placement and P&L tracking
 * without using real money.
 */
class DemoTradingService {
	private balance: number;

	constructor() {
		this.balance = DEFAULT_STRATEGY_CONFIG.botAllowance;
	}

	async initialize(): Promise<void> {
		const sc = await getStrategyConfig();
		this.balance = await redisService.getBotBalance(sc);
		if (
			isNaN(this.balance) ||
			this.balance === null ||
			this.balance === undefined
		) {
			this.balance = sc.botAllowance;
			await redisService.setBotBalance(this.balance);
		}
		logger.info(
			`🎮 Demo trading initialized | Balance: $${this.balance.toFixed(2)} USDC`,
		);
	}

	async getBalance(): Promise<number> {
		const sc = await getStrategyConfig();
		this.balance = await redisService.getBotBalance(sc);
		return this.balance;
	}

	/**
	 * Simulate buying a position
	 */
	async placeBuyOrder(
		tokenId: string,
		price: number,
		size: number,
		market: Market,
		direction: 'UP' | 'DOWN',
		confidence: number = 0,
		indicators: Trade['indicators'] = undefined,
	): Promise<Trade | null> {
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

		const sc = await getStrategyConfig();
		this.balance = await redisService.getBotBalance(sc);
		const cost = price * size;

		if (isNaN(cost) || cost > this.balance) {
			logger.warn(
				`Insufficient demo balance: $${this.balance.toFixed(2)} < $${cost.toFixed(2)}`,
			);
			return null;
		}

		const fee = calculateFee(size, price);

		this.balance -= cost + fee;
		await redisService.setBotBalance(this.balance);

		const trade: Trade = {
			id: randomUUID(),
			type: TradeType.DEMO,
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
			fee,
			status: TradeStatus.OPEN,
			startTime: market.startTime.toISOString(),
			endTime: market.endTime.toISOString(),
			enteredAt: new Date().toISOString(),
			priceToBeat: market.priceToBeat ?? 0,
			confidence,
			pnl: 0,
			indicators,
		};

		await redisService.saveTrade(trade);

		logger.trade('📝 DEMO BUY', {
			direction,
			price: price.toFixed(3),
			size,
			cost: `$${cost.toFixed(2)}`,
			fee: `$${fee.toFixed(4)}`,
			balance: `$${this.balance.toFixed(2)}`,
			market: market.title,
		});

		return trade;
	}

	/**
	 * Simulate selling a position (take profit or stop loss)
	 * Updates local trade object only. Stats/Balance handled by QueueService.
	 */
	async placeSellOrder(
		trade: Trade,
		currentPrice: number,
		reason: string = 'sell',
		btcPrice?: number,
	): Promise<Trade> {
		const pctChange =
			trade.entryPrice > 0
				? (currentPrice - trade.entryPrice) / trade.entryPrice
				: 0;

		const logLabel = pctChange >= 0 ? '🟢 TAKE PROFIT' : '🔴 STOP LOSS';
		logger.trade(`📝 DEMO SELL (Simulation) - ${logLabel}`, {
			direction: trade.direction,
			entry: trade.entryPrice.toFixed(3),
			exit: currentPrice.toFixed(3),
			change: `${(pctChange * 100).toFixed(1)}%`,
			market: trade.title,
		});

		logger.profit(0, pctChange); // Log profit but don't commit yet

		return trade;
	}

	/**
	 * Resolve a trade at market close (simulate final resolution)
	 * Updates local trade object only. Stats/Balance handled by QueueService.
	 */
	async resolveTrade(
		trade: Trade,
		won: boolean,
		btcPrice?: number,
	): Promise<Trade> {
		const status = won ? 'won' : 'lost';

		const emoji = won ? '🏆' : '❌';
		logger.trade(
			`${emoji} DEMO RESOLVED (Simulation) - ${status.toUpperCase()}`,
			{
				direction: trade.direction,
				entry: trade.entryPrice.toFixed(3),
				market: trade.title,
			},
		);

		return trade;
	}

	async printStats(): Promise<void> {
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
		logger.info(`   Total Fees:   $${stats.totalFees.toFixed(4)}`);
		logger.info('═══════════════════════════════════════');
	}
}

const demoTradingService = new DemoTradingService();
export default demoTradingService;
