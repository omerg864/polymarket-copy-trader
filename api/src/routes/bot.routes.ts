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

router.use(authGuard);

router.get('/summary', asyncHandler(getSummary));
router.get('/active-trades', asyncHandler(listActiveTrades));
router.get('/trade-history', asyncHandler(listTradeHistory));
router.post('/stop', adminGuard, asyncHandler(stopBot));
router.get('/config', asyncHandler(getBotConfig));
router.put('/config', adminGuard, asyncHandler(updateConfig));
router.get('/redis-stats', asyncHandler(getRedisStats));
router.get('/market-prices', asyncHandler(getMarketPricesData));
router.post('/flush-redis', adminGuard, asyncHandler(flushRedisData));

export default router;
