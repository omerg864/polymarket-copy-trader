import mongoose from 'mongoose';
import config, { validateLiveConfig } from './config';
import demoTradingService from './services/demoTrading';
import polymarketService from './services/polymarket';
import redisService from './services/redis';
import queueService from './services/queueService';
import strategyEngine from './strategy/engine';
import logger from './utils/logger';

// Bot mode is determined by MODE environment variable in config.ts

async function main(): Promise<void> {
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
			const message =
				error instanceof Error ? error.message : String(error);
			logger.error(message);
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
		const message = error instanceof Error ? error.message : String(error);
		logger.error(`Failed to connect to Redis: ${message}`);
		logger.error(
			'Make sure Redis is running. Install with: brew install redis && redis-server',
		);
		process.exit(1);
	}

	// Initialize MongoDB
	if (config.mongoUri) {
		try {
			await mongoose.connect(config.mongoUri);
			logger.info('📦 Connected to MongoDB');
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			logger.warn(
				`Failed to connect to MongoDB: ${message}. Strategy config will use Redis/defaults only.`,
			);
		}
	} else {
		logger.warn(
			'MONGO_URI not set. Strategy config will use Redis/defaults only.',
		);
	}

	// Initialize Polymarket service
	try {
		await polymarketService.initialize();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logger.error(`Failed to initialize Polymarket: ${message}`);
		process.exit(1);
	}

	// Initialize demo trading if in demo mode
	if (config.isDemo) {
		await demoTradingService.initialize();
	}

	// Start BullMQ workers
	await queueService.startWorkers();

	// Start the strategy engine
	await strategyEngine.start();
}

// Graceful shutdown
let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
	if (shuttingDown) return;
	shuttingDown = true;

	logger.info(`\n${signal} received. Shutting down gracefully...`);

	try {
		await strategyEngine.stop();
		await queueService.stopWorkers();
		await redisService.disconnect();
		await mongoose.disconnect();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logger.error(`Error during shutdown: ${message}`);
	}

	process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (error: Error) => {
	logger.error(`Uncaught exception: ${error.message}`);
	logger.error(error.stack || '');
	shutdown('uncaughtException');
});
process.on('unhandledRejection', (reason: unknown) => {
	logger.error(`Unhandled rejection: ${reason}`);
	shutdown('unhandledRejection');
});

// Run
main().catch((error: Error) => {
	logger.error(`Fatal error: ${error.message}`);
	logger.error(error.stack || '');
	process.exit(1);
});
