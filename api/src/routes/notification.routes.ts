import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import { getConfig, updateConfig } from '../controllers/notification.controller';
import { adminGuard } from '../middleware/auth';

const router = Router();

router.get('/', asyncHandler(getConfig));
router.put('/', adminGuard, asyncHandler(updateConfig));

export default router;
