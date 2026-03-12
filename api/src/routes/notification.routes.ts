import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import {
	getConfig,
	handleWebhook,
	triggerNotification,
	updateConfig,
} from '../controllers/notification.controller';
import { apiAuthGuard } from '../middleware/apiAuth';
import { adminGuard, authGuard } from '../middleware/auth';

const router = Router();

router.get('/', authGuard, asyncHandler(getConfig));
router.put('/', authGuard, adminGuard, asyncHandler(updateConfig));
router.post('/webhook', asyncHandler(handleWebhook));
router.post('/notify', apiAuthGuard, asyncHandler(triggerNotification));

export default router;
