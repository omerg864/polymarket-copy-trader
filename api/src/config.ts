import 'dotenv/config';

const config = {
	// Mode
	mode: process.env.MODE || 'demo',
	isDemo: (process.env.MODE || 'demo') === 'demo',

	// Auth
	authPassword: process.env.AUTH_PASSWORD || '',

	// Redis
	redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

	// API
	port: parseInt(process.env.API_PORT || '3001', 10),

	clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

	// Trading strategy — dynamic order sizing
	minOrderSizeUsd: parseFloat(process.env.MIN_ORDER_SIZE || '5'),
	maxOrderSizeUsd: parseFloat(process.env.MAX_ORDER_SIZE || '20'),
	confidenceThreshold: parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.70'),
	takeProfitPct: parseFloat(process.env.TAKE_PROFIT_PCT || '0.30'),
	stopLossPct: parseFloat(process.env.STOP_LOSS_PCT || '0.20'),

	// Trading limits
	maxConcurrentTrades: parseInt(process.env.MAX_CONCURRENT_TRADES || '3', 10),
	minEntryPrice: parseFloat(process.env.MIN_ENTRY_PRICE || '0.80'),
	minMarketAgeMinutes: parseFloat(
		process.env.MIN_MARKET_AGE_MINUTES || '2.0',
	),

	// Price analysis
	candleCount: parseInt(process.env.CANDLE_COUNT || '60', 10),
	rsiPeriod: parseInt(process.env.RSI_PERIOD || '14', 10),
	emaFast: parseInt(process.env.EMA_FAST || '9', 10),
	emaSlow: parseInt(process.env.EMA_SLOW || '21', 10),

	// Risk monitoring
	riskMonitorIntervalMs: parseInt(
		process.env.RISK_MONITOR_INTERVAL_MS || '2000',
		10,
	),

	// Virtual Bot Balance
	botAllowance: parseFloat(process.env.BOT_ALLOWANCE || '100'),

	// High price trade sizing bonus
	highPriceThreshold: parseFloat(process.env.HIGH_PRICE_THRESHOLD || '0.90'),
	highPriceMaxBonusPct: parseFloat(
		process.env.HIGH_PRICE_MAX_BONUS_PCT || '1.0',
	),
} as const;

export default config;
