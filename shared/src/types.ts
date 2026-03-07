export interface TradeSummary {
	balance: number;
	initialBalance: number;
	totalPnl: number;
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
	size: number;
	cost: number;
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
		bbUpper?: string;
		momentum3: string;
		volatility: string;
	};
}

export interface BotConfig {
	mode: string;
	minOrderSizeUsd: number;
	maxOrderSizeUsd: number;
	confidenceThreshold: number;
	takeProfitPct: number;
	stopLossPct: number;
	maxConcurrentTrades: number;
	minEntryPrice: number;
	minMarketAgeMinutes: number;
	candleCount: number;
	rsiPeriod: number;
	emaFast: number;
	emaSlow: number;
	riskMonitorIntervalMs: number;
	botAllowance: number;
	highPriceThreshold: number;
	highPriceMaxBonusPct: number;
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
}
