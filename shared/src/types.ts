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
	TEST = 'test',
}

export enum TradeStatus {
	OPEN = 'open',
	WON = 'won',
	LOST = 'lost',
	CLOSED_TP = 'closed_tp',
	CLOSED_SL = 'closed_sl',
	CLOSED_FCT = 'closed_fct',
	CLOSED_SELL = 'closed_sell',
	AWAITING_RESOLVE = 'awaiting_resolve',
}

export enum OrderStatus {
	LIVE = 'LIVE',
	INVALID = 'INVALID',
	CANCELED_MARKET_RESOLVED = 'CANCELED_MARKET_RESOLVED',
	CANCELED = 'CANCELED',
	MATCHED = 'MATCHED',
}

export interface ClobOrder {
	id: string;
	status: OrderStatus;
	owner: string;
	maker_address: string;
	market: string;
	asset_id: string;
	side: string;
	original_size: string;
	size_matched: string;
	price: string;
	outcome: string;
	expiration: string;
	order_type: string;
	associate_trades: any[];
	created_at: number;
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
	size: number;
	cost: number;
	fee: number;
	status: TradeStatus;
	startTime: string;
	endTime: string;
	enteredAt: string;
	closedAt?: string;
	pnl: number;
	pctChange?: number;
	confidence?: number;
	indicators?: any;
	copyFrom?: string; // Nickname or address of the wallet copied
	actualOutcome?: 'UP' | 'DOWN' | 'UNKNOWN';
}

export interface CopyWallet {
	address: string;
	nickname: string;
}

export interface StrategyConfig {
	mode?: TradeType;
	fixedOrderSizeUsd: number;
	maxConcurrentTrades: number;
	botAllowance: number;
	cycleIntervalMs: number;
	dayPnlGoal: number;
	dailyTakeProfit: number;
	dailyStopLoss: number;
	timezone: string;
	riskMonitorIntervalMs: number;
	wallets: CopyWallet[];
	excludedTimeWindows: { start: string; end: string }[];
}

export const DEFAULT_STRATEGY_CONFIG: StrategyConfig = {
	fixedOrderSizeUsd: 100,
	maxConcurrentTrades: 3,
	botAllowance: 100,
	cycleIntervalMs: 5000,
	riskMonitorIntervalMs: 5000,
	dayPnlGoal: 2,
	dailyTakeProfit: -1,
	dailyStopLoss: 1,
	timezone: 'Asia/Jerusalem',
	wallets: [],
	excludedTimeWindows: [],
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
	upPrice: number | null;
	downPrice: number | null;
	updatedAt: number;
	marketTitle: string | null;
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
	awaitingResolveTrades: {
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
		sumBanking: number;
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

export enum SimulationType {
	TIME_WINDOWS = 'time_windows',
	DAILY_TP = 'daily_tp',
}

export interface SimulationParams {
	type: SimulationType;
	mode: TradeType;
	params: Record<string, any>;
}

export interface SimulationDailyStat {
	date: string;
	actPnL: number;
	simPnL: number;
	actWins: number;
	simWins: number;
	actTrades: number;
	simTrades: number;
	tpHit?: boolean;
}

export interface SimulationResult {
	type: SimulationType;
	mode: TradeType;
	overall: {
		totalActPnL: number;
		totalSimPnL: number;
		totalActTrades: number;
		totalSimTrades: number;
		totalActWins: number;
		totalSimWins: number;
		actWR: number;
		simWR: number;
		avgDailyActPnL: number;
		avgDailySimPnL: number;
		impact: number;
	};
	daily: SimulationDailyStat[];
}

export interface BankingTransaction {
	id?: string;
	amount: number;
	type: 'deposit' | 'withdrawal';
	mode: TradeType;
	description?: string;
	createdAt: string;
}
