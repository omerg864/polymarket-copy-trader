import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import {
	flushRedisData,
	getBotConfig,
	getMarketPricesData,
	getRedisStats,
	getSummary,
	listActiveTrades,
	listTradeHistory,
	stopBot,
	updateConfig,
	verifyAuth,
} from '../controllers/bot.controller';
import { adminGuard, authGuard } from '../middleware/auth';

const router = Router();

router.post('/auth/verify', verifyAuth);

router.get('/summary', authGuard, asyncHandler(getSummary));
router.get('/active-trades', authGuard, asyncHandler(listActiveTrades));
router.get('/trade-history', authGuard, asyncHandler(listTradeHistory));
router.post('/stop', authGuard, adminGuard, asyncHandler(stopBot));
router.get('/config', authGuard, asyncHandler(getBotConfig));
router.put('/config', authGuard, adminGuard, asyncHandler(updateConfig));
router.get('/redis-stats', authGuard, asyncHandler(getRedisStats));
router.get('/market-prices', authGuard, asyncHandler(getMarketPricesData));
router.post(
	'/flush-redis',
	authGuard,
	adminGuard,
	asyncHandler(flushRedisData),
);

export default router;
