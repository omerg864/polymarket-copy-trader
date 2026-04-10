export interface TradeSummary {
	balance: number;
	initialBalance: number;
	totalPnl: number;
	todayPnl: number;
	todayWins?: number;
	todayLosses?: number;
	todayTrades?: number;
	totalFees: number;
	totalTrades: number;
	wins: number;
	losses: number;
	winRate: string;
	activeTrades: number;
	isStopping: boolean;
	botStartTime?: number | null;
}

export enum TradeType {
	DEMO = 'demo',
	LIVE = 'live',
}

export enum TradeStatus {
	OPEN = 'open',
	WON = 'won',
	LOST = 'lost',
	CLOSED_TP = 'closed_tp',
	CLOSED_SL = 'closed_sl',
	CLOSED_FCT = 'closed_fct',
	CLOSED_SELL = 'closed_sell',
}

export interface Trade {
	id: string;
	type: TradeType;
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
	status: TradeStatus;
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
		analysisBtcPrice: number;
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
		rsi14Pass?: boolean;
		stochRsiPass?: boolean;
		bbPositionPass?: boolean;
		entryPricePass?: boolean;
		marketPricePass?: boolean;
		timeFramePass?: boolean;
		timeRemaining?: string;
	};
	actualOutcome?: 'UP' | 'DOWN' | 'UNKNOWN';
}

export interface StrategyConfig {
	mode?: string;
	fixedOrderSizeUsd: number;
	minConfidence: number;
	takeProfitType: 'market' | 'percent';
	marketPriceTakeProfit: number;
	takeProfitPct: number;
	stopLossType: 'market' | 'percent';
	marketPriceStopLoss: number;
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
	minSecondsRemaining: number;
	btcPriceOffset: number;
	dailyTakeProfit: number;
	dailyStopLoss: number;
	fctBtcOffset: number;
	timezone: string;
}

export const DEFAULT_STRATEGY_CONFIG: StrategyConfig = {
	fixedOrderSizeUsd: 100,
	minConfidence: 70,
	takeProfitType: 'percent',
	marketPriceTakeProfit: 0.98,
	takeProfitPct: 30,
	stopLossType: 'market',
	marketPriceStopLoss: 0.4,
	stopLossPct: 25, // 25% default percentage SL
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
	minSecondsRemaining: 30,
	btcPriceOffset: 5,
	dailyTakeProfit: -1,
	dailyStopLoss: 1,
	fctBtcOffset: 4,
	timezone: 'Asia/Jerusalem',
};

export interface NotificationConfig {
	minTodayPnLNotification: number;
	maxTodayPnLNotification: number;
	notificationOnTrade: boolean;
	notificationOnTp: boolean;
	notificationOnSl: boolean;
	notificationOnFct: boolean;
	notificationOnWon: boolean;
	notificationOnLost: boolean;
	notificationOnPnlGoal: boolean;
	notificationOnError: boolean;
	authenticated_chats: string[];
}

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
	minTodayPnLNotification: -10,
	maxTodayPnLNotification: 0,
	notificationOnTrade: true,
	notificationOnTp: true,
	notificationOnSl: true,
	notificationOnFct: true,
	notificationOnWon: true,
	notificationOnLost: true,
	notificationOnPnlGoal: true,
	notificationOnError: true,
	authenticated_chats: [],
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
	upPrice?: number;
	downPrice?: number;
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

export interface PriceCandle {
	time: number;
	open: number;
	high: number;
	low: number;
	close: number;
	volume?: number;
}

export interface Signal {
	direction: 'UP' | 'DOWN';
	confidence: number;
	indicators: Trade['indicators'];
	updatedAt?: number;
}

export interface BotStats {
	totalTrades: number;
	wins: number;
	losses: number;
	totalPnl: number;
	totalFees: number;
}

export type NotificationType =
	| 'trade'
	| 'win'
	| 'loss'
	| 'goal'
	| 'min_pnl'
	| 'max_pnl'
	| 'error'
	| 'manual';

export interface RedisInfo {
	memoryUsed: string;
	memoryUsedBytes: number;
	totalKeys: number;
}

export interface MongoInfo {
	totalTrades: number;
	storageSize: string;
	storageSizeInBytes: number;
}

export interface MarketDashboardData {
	btcPrice: number;
	priceToBeat: number | null;
	upPrice: number | null;
	downPrice: number | null;
	updatedAt: number;
	marketTitle: string | null;
	marketStartTime: number | null;
	marketEndTime: number | null;
	indicators?: Trade['indicators'];
	confidence?: number;
	direction?: 'UP' | 'DOWN';
	indicatorsUpdatedAt?: number;
}

export interface BotVersions {
	bot: string | null;
	api: string;
}

export interface VerificationResult {
	success: boolean;
	fix: boolean;
	initialBalance: number;
	activeTrades: {
		count: number;
		cost: number;
		fee: number;
	};
	historyTrades: {
		count: number;
	};
	computed: {
		sumFees: number;
		sumPnl: number;
		expectedBalance: number;
		wins: number;
		losses: number;
		totalTrades: number;
		todayPnl: number;
		todayWins: number;
		todayLosses: number;
	};
	redis: {
		totalFees: number;
		totalPnl: number;
		balance: number;
		wins: number;
		losses: number;
		totalTrades: number;
		todayPnl: number;
		todayWins: number;
		todayLosses: number;
		dailyType: string;
	};
	matches: {
		fees: boolean;
		pnl: boolean;
		balance: boolean;
		wins: boolean;
		losses: boolean;
		totalTrades: boolean;
		todayPnl: boolean;
		todayWins: boolean;
		todayLosses: boolean;
	};
	needsFix: boolean;
	logs: string[];
}
