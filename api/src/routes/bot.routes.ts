import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import {
	getBotConfig,
	getMarketPricesData,
	getMongoStats,
	getRedisStats,
	getSummary,
	getTimezones,
	getVersions,
	listActiveTrades,
	listTradeHistory,
	resetBotData,
	stopBot,
	updateBotStartTime,
	updateConfig,
	verifyAuth,
	verifyStats,
	addBankingTransaction,
} from '../controllers/bot.controller';
import { adminGuard, authGuard } from '../middleware/auth';

const router = Router();

router.post('/auth/verify', verifyAuth);

router.get('/summary', authGuard, asyncHandler(getSummary));
router.get('/active-trades', authGuard, asyncHandler(listActiveTrades));
router.get('/trade-history', authGuard, asyncHandler(listTradeHistory));
router.post('/stop', authGuard, adminGuard, asyncHandler(stopBot));
router.get('/config', authGuard, asyncHandler(getBotConfig));
router.get('/timezones', authGuard, getTimezones);
router.get('/versions', authGuard, asyncHandler(getVersions));
router.put('/config', authGuard, adminGuard, asyncHandler(updateConfig));
router.post('/bot-start-time', authGuard, adminGuard, asyncHandler(updateBotStartTime));
router.get('/redis-stats', authGuard, asyncHandler(getRedisStats));
router.get('/mongo-stats', authGuard, asyncHandler(getMongoStats));
router.get('/market-prices', authGuard, asyncHandler(getMarketPricesData));
router.post(
	'/reset-bot',
	authGuard,
	adminGuard,
	asyncHandler(resetBotData),
);
router.post(
	'/verify-stats',
	authGuard,
	adminGuard,
	asyncHandler(verifyStats),
);
router.post(
	'/banking/transaction',
	authGuard,
	adminGuard,
	asyncHandler(addBankingTransaction),
);

export default router;
