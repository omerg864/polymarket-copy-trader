import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import { getCandles } from '../controllers/price.controller';
import { authGuard } from '../middleware/auth';

const router = Router();

router.get('/candles', authGuard, asyncHandler(getCandles));

export default router;
