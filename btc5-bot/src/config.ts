import 'dotenv/config';

const config = {
	// Mode
	mode: process.env.MODE || 'demo',
	isDemo: (process.env.MODE || 'demo') === 'demo',

	// Polymarket credentials
	privateKey: process.env.PRIVATE_KEY || '',
	funderAddress: process.env.FUNDER_ADDRESS || '',
	signatureType: parseInt(process.env.SIGNATURE_TYPE || '0', 10),

	// Polymarket API
	clobHost: 'https://clob.polymarket.com',
	gammaHost: 'https://gamma-api.polymarket.com',
	chainId: 137, // Polygon

	// Redis
	redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

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

	// Logging
	logLevel: process.env.LOG_LEVEL || 'info',

	// Series info for BTC 5-minute markets
	seriesTicker: 'btc-up-or-down-5m',
	marketTag: '5M',
	tickSize: '0.01',
	negRisk: false,
	minOrderSize: 5,

	// Virtual Bot Balance (applies to demo tracking, and live allowance)
	botAllowance: parseFloat(process.env.BOT_ALLOWANCE || '100'),

	// Risk monitoring
	riskMonitorIntervalMs: parseInt(
		process.env.RISK_MONITOR_INTERVAL_MS || '2000',
		10,
	),

	// High price trade sizing bonus
	highPriceThreshold: parseFloat(process.env.HIGH_PRICE_THRESHOLD || '0.90'),
	highPriceMaxBonusPct: parseFloat(
		process.env.HIGH_PRICE_MAX_BONUS_PCT || '1.0',
	),
};

export function validateLiveConfig(): void {
	const errors: string[] = [];
	if (
		!config.privateKey ||
		config.privateKey === '0x_your_private_key_here'
	) {
		errors.push('PRIVATE_KEY is required for live trading');
	}
	if (
		!config.funderAddress ||
		config.funderAddress === '0x_your_funder_address_here'
	) {
		errors.push('FUNDER_ADDRESS is required for live trading');
	}
	if (errors.length > 0) {
		throw new Error(`Live mode config errors:\n${errors.join('\n')}`);
	}
}

export default config;
