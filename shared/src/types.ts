export interface TradeSummary {
	balance: number;
	initialBalance: number;
	totalPnl: number;
	totalFees: number;
	totalTrades: number;
	wins: number;
	losses: number;
	winRate: string;
	activeTrades: number;
	isStopping: boolean;
	botStartTime?: number | null;
}

export interface Trade {
	id: string;
	type: 'demo' | 'live';
	direction: 'UP' | 'DOWN';
	tokenId: string;
	conditionId: string;
	slug: string;
	eventTicker: string;
	title: string;
	side: string;
	entryPrice: number;
	currentPrice: number;
	exitPrice?: number;
	exitBtcPrice?: number;
	size: number;
	cost: number;
	fee: number;
	status: string;
	startTime: string;
	endTime: string;
	enteredAt: string;
	closedAt?: string;
	priceToBeat: number;
	pnl: number;
	pctChange?: number;
	confidence?: number;
	indicators?: {
		currentPrice: number;
		priceToBeat: number | string;
		distFromRef: string;
		vwap?: string;
		vwapDistancePct?: string;
		microRsi: string;
		stochRsi?: string;
		rsi14: string;
		ema3: string;
		ema8: string;
		bbLower?: string;
		bbMiddle?: string;
		bbUpper?: string;
		bbPosition?: string;
		momentum3: string;
		volatility: string;
	};
}

export interface StrategyConfig {
	mode?: string;
	minOrderSizeUsd: number;
	maxOrderSizeUsd: number;
	confidenceThreshold: number;
	takeProfitPct: number;
	stopLossPct: number;
	maxConcurrentTrades: number;
	minEntryPrice: number;
	maxEntryPrice: number;
	minStochRSI: number;
	maxStochRSI: number;
	minRSI14: number;
	maxRSI14: number;
	minBBPosition: number;
	maxBBPosition: number;
	minMarketAgeMinutes: number;
	candleCount: number;
	rsiPeriod: number;
	emaFast: number;
	emaSlow: number;
	riskMonitorIntervalMs: number;
	botAllowance: number;
	highPriceThreshold: number;
	highPriceMaxBonusPct: number;
	maxSecLoseFct: number;
	cycleIntervalMs: number;
	dayPnlGoal: number;
}

export const DEFAULT_STRATEGY_CONFIG: StrategyConfig = {
	minOrderSizeUsd: 5,
	maxOrderSizeUsd: 20,
	confidenceThreshold: 0.7,
	takeProfitPct: 0.3,
	stopLossPct: 0.2,
	maxConcurrentTrades: 3,
	minEntryPrice: 0.8,
	maxEntryPrice: 0.95,
	minStochRSI: 20,
	maxStochRSI: 89,
	minRSI14: 30,
	maxRSI14: 65,
	minBBPosition: 0,
	maxBBPosition: 85,
	minMarketAgeMinutes: 2,
	candleCount: 60,
	rsiPeriod: 14,
	emaFast: 9,
	emaSlow: 21,
	riskMonitorIntervalMs: 2000,
	botAllowance: 100,
	highPriceThreshold: 0.9,
	highPriceMaxBonusPct: 1.0,
	maxSecLoseFct: 13,
	cycleIntervalMs: 5000,
	dayPnlGoal: 2,
};

export interface NotificationConfig {
	minTodayPnLNotification: number;
	maxTodayPnLNotification: number;
	notificationOnWin: boolean;
	notificationOnLoss: boolean;
	notificationOnPnlGoal: boolean;
}

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
	minTodayPnLNotification: -10,
	maxTodayPnLNotification: 0,
	notificationOnWin: true,
	notificationOnLoss: true,
	notificationOnPnlGoal: true,
};

export function resolveStrategyConfig(
	partial: Partial<StrategyConfig>,
): StrategyConfig {
	return { ...DEFAULT_STRATEGY_CONFIG, ...partial };
}

export interface Market {
	conditionId: string;
	questionId: string;
	slug: string;
	eventTicker: string;
	title: string;
	startTime: Date;
	endTime: Date;
	upTokenId: string;
	downTokenId: string;
	tickSize: string;
	negRisk: boolean;
	minOrderSize: number;
	priceToBeat: number | null;
}

export interface MarketPrices {
	upPrice: number;
	downPrice: number;
	bestBid: number;
	bestAsk: number;
}

export interface Candle {
	openTime: number;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
	closeTime: number;
}

export interface Signal {
	direction: 'UP' | 'DOWN';
	confidence: number;
	indicators: Trade['indicators'];
}

export interface BotStats {
	totalTrades: number;
	wins: number;
	losses: number;
	totalPnl: number;
	totalFees: number;
}

export type NotificationType =
	| 'win'
	| 'loss'
	| 'goal'
	| 'min_pnl'
	| 'max_pnl'
	| 'manual';

/**
 * Calculate Polymarket taker fee for crypto markets.
 * Formula: fee = shares × price × feeRate × (price × (1 - price))^exponent
 * Crypto: feeRate = 0.0175, exponent = 1
 */
export function calculateFee(shares: number, price: number): number {
	const FEE_RATE = 0.0175;
	const EXPONENT = 1;
	const raw =
		shares * price * FEE_RATE * Math.pow(price * (1 - price), EXPONENT);
	return Math.round(raw * 10000) / 10000; // 4 decimal precision
}
