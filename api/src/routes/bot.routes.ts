import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import {
	flushRedisData,
	getBotConfig,
	getRedisStats,
	getSummary,
	listActiveTrades,
	listTradeHistory,
	stopBot,
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
router.get('/config', getBotConfig);
router.get('/redis-stats', asyncHandler(getRedisStats));
router.post('/flush-redis', adminGuard, asyncHandler(flushRedisData));

export default router;
