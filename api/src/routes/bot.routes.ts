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
} from '../controllers/bot.controller';

const router = Router();

router.get('/summary', asyncHandler(getSummary));
router.get('/active-trades', asyncHandler(listActiveTrades));
router.get('/trade-history', asyncHandler(listTradeHistory));
router.post('/stop', asyncHandler(stopBot));
router.get('/config', getBotConfig);
router.get('/redis-stats', asyncHandler(getRedisStats));
router.post('/flush-redis', asyncHandler(flushRedisData));

export default router;
