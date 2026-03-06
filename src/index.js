import config, { validateLiveConfig } from './config.js';
import logger from './utils/logger.js';
import redisService from './services/redis.js';
import polymarketService from './services/polymarket.js';
import demoTradingService from './services/demoTrading.js';
import strategyEngine from './strategy/engine.js';

// Parse CLI arguments
const args = process.argv.slice(2);
if (args.includes('--demo')) {
	config.mode = 'demo';
	config.isDemo = true;
} else if (args.includes('--live')) {
	config.mode = 'live';
	config.isDemo = false;
}

async function main() {
	logger.info('');
	logger.info('╔═══════════════════════════════════════════╗');
	logger.info('║  Polymarket BTC 5-Min Trading Bot v1.0.0  ║');
	logger.info('╚═══════════════════════════════════════════╝');
	logger.info('');

	// Validate config for live mode
	if (!config.isDemo) {
		try {
			validateLiveConfig();
		} catch (error) {
			logger.error(error.message);
			logger.error(
				'Please set up your .env file. See .env.example for reference.',
			);
			process.exit(1);
		}
	}

	// Initialize Redis
	try {
		await redisService.connect();
	} catch (error) {
		logger.error(`Failed to connect to Redis: ${error.message}`);
		logger.error(
			'Make sure Redis is running. Install with: brew install redis && redis-server',
		);
		process.exit(1);
	}

	// Initialize Polymarket service
	try {
		await polymarketService.initialize();
	} catch (error) {
		logger.error(`Failed to initialize Polymarket: ${error.message}`);
		process.exit(1);
	}

	// Initialize demo trading if in demo mode
	if (config.isDemo) {
		await demoTradingService.initialize();
	}

	// Start the strategy engine
	await strategyEngine.start();
}

// Graceful shutdown
let shuttingDown = false;
async function shutdown(signal) {
	if (shuttingDown) return;
	shuttingDown = true;

	logger.info(`\n${signal} received. Shutting down gracefully...`);

	try {
		await strategyEngine.stop();
		await redisService.disconnect();
	} catch (error) {
		logger.error(`Error during shutdown: ${error.message}`);
	}

	process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (error) => {
	logger.error(`Uncaught exception: ${error.message}`);
	logger.error(error.stack);
	shutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
	logger.error(`Unhandled rejection: ${reason}`);
	shutdown('unhandledRejection');
});

// Run
main().catch((error) => {
	logger.error(`Fatal error: ${error.message}`);
	logger.error(error.stack);
	process.exit(1);
});
