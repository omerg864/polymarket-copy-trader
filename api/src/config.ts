import 'dotenv/config';

const config = {
	// Mode
	mode: process.env.MODE || 'demo',
	isDemo: (process.env.MODE || 'demo') === 'demo',

	// Auth
	adminPassword: process.env.ADMIN_PASSWORD || '',
	readonlyPassword: process.env.READONLY_PASSWORD || '',

	// Redis
	redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

	// MongoDB
	mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/polymarket-bot',

	// API
	port: parseInt(process.env.API_PORT || '3001', 10),

	clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
} as const;

export default config;
