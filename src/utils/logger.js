import winston from 'winston';
import config from '../config.js';
import { mkdirSync } from 'fs';

// Ensure logs directory exists
try {
	mkdirSync('logs', { recursive: true });
} catch {
	// ignore
}

const { combine, timestamp, printf, colorize, align } = winston.format;

const logFormat = printf(({ level, message, timestamp, ...meta }) => {
	const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
	return `${timestamp} [${level}]${metaStr} ${message}`;
});

const logger = winston.createLogger({
	level: config.logLevel,
	format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
	transports: [
		new winston.transports.Console({
			format: combine(
				colorize({ all: true }),
				timestamp({ format: 'HH:mm:ss' }),
				logFormat,
			),
		}),
		new winston.transports.File({
			filename: 'logs/bot.log',
			maxsize: 5 * 1024 * 1024, // 5MB
			maxFiles: 3,
		}),
		new winston.transports.File({
			filename: 'logs/trades.log',
			level: 'info',
			maxsize: 5 * 1024 * 1024,
			maxFiles: 5,
			format: combine(
				timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
				winston.format.json(),
			),
		}),
	],
});

// Convenience methods for trade-specific logging
logger.trade = (action, data) => {
	logger.info(`📊 [TRADE] ${action}`, data);
};

logger.signal = (direction, confidence, indicators) => {
	const emoji = direction === 'UP' ? '🟢' : '🔴';
	logger.info(
		`${emoji} [SIGNAL] ${direction} (confidence: ${(confidence * 100).toFixed(1)}%)`,
		{ indicators },
	);
};

logger.profit = (pnl, pctChange) => {
	const emoji = pnl >= 0 ? '💰' : '💸';
	logger.info(
		`${emoji} [P&L] ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${(pctChange * 100).toFixed(1)}%)`,
	);
};

export default logger;
