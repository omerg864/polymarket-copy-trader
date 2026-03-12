import type { Request, Response } from 'express';
import type { NotificationConfig } from '../../../shared/src/types';
import {
	getNotificationConfig,
	updateNotificationConfig,
} from '../services/notificationConfig';

export async function getConfig(_req: Request, res: Response): Promise<void> {
	const config = await getNotificationConfig();
	res.json(config);
}

export async function updateConfig(req: Request, res: Response): Promise<void> {
	const updates = req.body as Partial<NotificationConfig>;
	const updated = await updateNotificationConfig(updates);
	res.json(updated);
}
