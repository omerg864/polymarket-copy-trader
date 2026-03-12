import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import {
	getConfig,
	handleWebhook,
	triggerNotification,
	updateConfig,
} from '../controllers/notification.controller';
import { apiAuthGuard } from '../middleware/apiAuth';
import { adminGuard } from '../middleware/auth';

const router = Router();

router.get('/', asyncHandler(getConfig));
router.put('/', adminGuard, asyncHandler(updateConfig));
router.post('/webhook', asyncHandler(handleWebhook));
router.post('/notify', apiAuthGuard, asyncHandler(triggerNotification));

export default router;
