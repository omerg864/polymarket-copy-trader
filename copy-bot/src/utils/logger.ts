import { mkdirSync } from 'fs';
import winston from 'winston';
import config from '../config';

// Ensure logs directory exists
try {
	mkdirSync('logs', { recursive: true });
} catch {
	// ignore
}

const { combine, timestamp, printf, colorize } = winston.format;

const logFormat = printf(({ level, message, timestamp: ts, ...meta }) => {
	const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
	return `${ts} [${level}]${metaStr} ${message}`;
});

interface ExtendedLogger extends winston.Logger {
	trade: (action: string, data?: Record<string, unknown>) => void;
	signal: (
		direction: string,
		confidence: number,
		indicators: Record<string, unknown>,
	) => void;
	profit: (pnl: number, pctChange: number) => void;
}

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
}) as ExtendedLogger;

// Convenience methods for trade-specific logging
logger.trade = (action: string, data?: Record<string, unknown>): void => {
	logger.info(`📊 [TRADE] ${action}`, data);
};

logger.signal = (
	direction: string,
	confidence: number,
	indicators: Record<string, unknown>,
): void => {
	const emoji = direction === 'UP' ? '🟢' : '🔴';
	logger.info(
		`${emoji} [SIGNAL] ${direction} (confidence: ${(confidence * 100).toFixed(1)}%)`,
		{ indicators },
	);
};

logger.profit = (pnl: number, pctChange: number): void => {
	const emoji = pnl >= 0 ? '💰' : '💸';
	logger.info(
		`${emoji} [P&L] ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${(pctChange * 100).toFixed(1)}%)`,
	);
};

export default logger;
