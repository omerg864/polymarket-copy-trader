import type { Request, Response } from 'express';
import type { NotificationConfig } from '../../../shared/src/types';
import {
	addTelegramChatId,
	getNotificationConfig,
	getTelegramChatIds,
	removeTelegramChatId,
	updateNotificationConfig,
} from '../services/notificationConfig';
import { TelegramService } from '../services/telegram';

export async function getConfig(_req: Request, res: Response): Promise<void> {
	const config = await getNotificationConfig();
	res.json(config);
}

export async function updateConfig(req: Request, res: Response): Promise<void> {
	const updates = req.body as Partial<NotificationConfig>;
	const updated = await updateNotificationConfig(updates);
	res.json(updated);
}

export async function handleWebhook(req: Request, res: Response): Promise<void> {
	const { message } = req.body;
	if (!message || !message.text || !message.chat) {
		res.sendStatus(200);
		return;
	}

	const chatId = message.chat.id.toString();
	const text = message.text.trim();

	if (text === '/subscribe') {
		await addTelegramChatId(chatId);
		await TelegramService.sendMessage(chatId, '✅ You have subscribed to Polymarket bot notifications.');
	} else if (text === '/unsubscribe') {
		await removeTelegramChatId(chatId);
		await TelegramService.sendMessage(chatId, '❌ You have unsubscribed from Polymarket bot notifications.');
	}

	res.sendStatus(200);
}

export async function triggerNotification(req: Request, res: Response): Promise<void> {
	const { type, data } = req.body;
	const config = await getNotificationConfig();

	let shouldNotify = false;
	let message = '';

	if (type === 'win' && config.notificationOnWin) {
		shouldNotify = true;
		message = `<b>🚀 NEW WIN!</b>\n\n` +
				  `<b>Market:</b> ${data.title || 'Unknown'}\n` +
				  `<b>Profit:</b> <code class="text-emerald-400">$${data.pnl?.toFixed(2)}</code>\n` +
				  `<b>Return:</b> ${(data.pctChange * 100)?.toFixed(2)}%\n` +
				  `<b>Exit Price:</b> $${data.exitPrice}`;
	} else if (type === 'loss' && config.notificationOnLoss) {
		shouldNotify = true;
		message = `<b>📉 Trade Loss</b>\n\n` +
				  `<b>Market:</b> ${data.title || 'Unknown'}\n` +
				  `<b>Loss:</b> <code class="text-red-400">$${Math.abs(data.pnl)?.toFixed(2)}</code>\n` +
				  `<b>Return:</b> ${(data.pctChange * 100)?.toFixed(2)}%\n` +
				  `<b>Exit Price:</b> $${data.exitPrice}`;
	} else if (type === 'goal' && config.notificationOnPnlGoal) {
		shouldNotify = true;
		message = `<b>🏆 DAILY GOAL REACHED!</b>\n\n` +
				  `<b>Today's P&L:</b> <code class="text-emerald-400">$${data.todayPnl?.toFixed(2)}</code>\n` +
				  `<b>Goal:</b> $${data.goal}\n` +
				  `<b>Total Trades:</b> ${data.totalTrades}`;
	} else if (type === 'manual') {
		shouldNotify = true;
		message = data.message || 'Manual notification triggered.';
	}

	if (shouldNotify && message) {
		const chatIds = await getTelegramChatIds();
		if (chatIds.length > 0) {
			await TelegramService.broadcast(chatIds, message);
		}
	}

	res.json({ success: true, notified: shouldNotify });
}
