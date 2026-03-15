import 'dotenv/config';

const config = {
	// Mode
	mode: process.env.MODE === 'live' ? 'live' : 'demo',
	isDemo: process.env.MODE !== 'live',

	// Polymarket credentials
	privateKey: process.env.PRIVATE_KEY || '',
	funderAddress: process.env.FUNDER_ADDRESS || '',
	signatureType: parseInt(process.env.SIGNATURE_TYPE || '0', 10),

	// Polymarket API
	clobHost: 'https://clob.polymarket.com',
	gammaHost: 'https://gamma-api.polymarket.com',
	mainHost: 'https://polymarket.com',
	chainId: 137, // Polygon

	// Redis
	redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

	// MongoDB
	mongoUri: process.env.MONGO_URI || '',

	// Logging
	logLevel: process.env.LOG_LEVEL || 'info',

	// Series info for BTC 5-minute markets
	seriesTicker: 'btc-up-or-down-5m',
	marketTag: '5M',
	tickSize: '0.01',
	negRisk: false,
	minOrderSize: 5,
	// Dashboard API
	apiUrl: process.env.API_URL || 'http://localhost:3001',
	apiPassword: process.env.API_PASSWORD || '',

	// Polygon RPC for on-chain CTF redemption (live mode only)
	polygonRpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
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
