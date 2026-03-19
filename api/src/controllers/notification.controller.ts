import type { Request, Response } from 'express';
import type {
	NotificationConfig,
	NotificationType,
} from '../../../shared/src/types';
import {
	addTelegramChatId,
	getNotificationConfig,
	getTelegramChatIds,
	removeTelegramChatId,
	updateNotificationConfig,
} from '../services/notificationConfig';
import {
	getActiveTrades,
	getBotBalance,
	getBotStartTime,
	getBotStats,
	getDailyPnl,
	getStopRequested,
} from '../services/redis';
import { DateTime } from 'luxon';
import { getStrategyConfig } from '../services/strategyConfig';
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

export async function handleWebhook(
	req: Request,
	res: Response,
): Promise<void> {
	const { message } = req.body;
	console.log(req.body);
	if (!message || !message.text || !message.chat) {
		res.sendStatus(200);
		return;
	}

	const chatId = message.chat.id.toString();
	const text = message.text.trim();

	if (text === '/subscribe') {
		await addTelegramChatId(chatId);
		await TelegramService.sendMessage(
			chatId,
			'✅ You have subscribed to Polymarket bot notifications.',
		);
	} else if (text === '/unsubscribe') {
		await removeTelegramChatId(chatId);
		await TelegramService.sendMessage(
			chatId,
			'❌ You have unsubscribed from Polymarket bot notifications.',
		);
	} else if (text === '/stats') {
		const [stats, activeTrades, botStartTime, isStopping, strategyConfig] =
			await Promise.all([
				getBotStats(),
				getActiveTrades(),
				getBotStartTime(),
				getStopRequested(),
				getStrategyConfig(),
			]);

		const balance = await getBotBalance(strategyConfig);
		const todayStr = DateTime.now()
			.setZone(strategyConfig.timezone)
			.toFormat('yyyy-MM-dd');
		const dailyPnl = await getDailyPnl(todayStr);

		const winRate =
			stats.totalTrades > 0
				? ((stats.wins / stats.totalTrades) * 100).toFixed(1)
				: '0.0';

		const uptime = botStartTime
			? Math.floor((Date.now() - botStartTime) / (1000 * 60 * 60))
			: 0;

		const statsMessage =
			`<b>📊 Bot Statistics</b>\n\n` +
			`<b>Balance:</b> <code class="text-emerald-400">$${balance.toFixed(2)}</code>\n` +
			`<b>Initial:</b> $${strategyConfig.botAllowance.toFixed(2)}\n` +
			`<b>Today's P&L:</b> <code class="${dailyPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}">$${dailyPnl.toFixed(2)}</code>\n` +
			`<b>Total P&L:</b> <code class="${stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}">$${stats.totalPnl.toFixed(2)}</code>\n` +
			`<b>Win Rate:</b> ${winRate}%\n` +
			`<b>Trades:</b> ${stats.totalTrades} (${stats.wins}W / ${stats.losses}L)\n` +
			`<b>Active Trades:</b> ${activeTrades.length}\n` +
			`<b>Uptime:</b> ${uptime} hours\n` +
			`<b>Status:</b> ${isStopping ? '🛑 Stopping' : '🏃 Running'}`;

		await TelegramService.sendMessage(chatId, statsMessage);
	}

	res.sendStatus(200);
}

export async function triggerNotification(
	req: Request,
	res: Response,
): Promise<void> {
	const { type, data }: { type: NotificationType; data: any } = req.body;
	const config = await getNotificationConfig();

	let shouldNotify = false;
	let message = '';

	if (type === 'win' && config.notificationOnWin) {
		const statusText = data.status === 'closed_tp' ? 'Take Profit' : 'Win';
		const todayPnl = data.todayPnl ?? 0;
		shouldNotify = true;
		message =
			`<b>🚀 NEW WIN!</b>\n\n` +
			`<b>Market:</b> ${data.title || 'Unknown'}\n` +
			`<b>Result:</b> ${statusText}\n` +
			`<b>Profit:</b> <code class="text-emerald-400">$${data.pnl?.toFixed(2)}</code>\n` +
			`<b>Return:</b> ${(data.pctChange * 100)?.toFixed(2)}%\n` +
			`<b>Today's P&L:</b> <code class="${todayPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}">$${todayPnl.toFixed(2)}</code>\n` +
			`<b>Exit Price:</b> $${data.exitPrice}\n` +
			`<b>Balance:</b> $${data.balance?.toFixed(2)}`;
	} else if (type === 'loss' && config.notificationOnLoss) {
		const statusText = data.status === 'closed_sl' 
			? 'Stop Loss' 
			: data.status === 'closed_fct' 
				? 'Forced Closure' 
				: 'Loss';
		const todayPnl = data.todayPnl ?? 0;
		shouldNotify = true;
		message =
			`<b>📉 Trade Loss</b>\n\n` +
			`<b>Market:</b> ${data.title || 'Unknown'}\n` +
			`<b>Result:</b> ${statusText}\n` +
			`<b>Loss:</b> <code class="text-red-400">$${Math.abs(data.pnl)?.toFixed(2)}</code>\n` +
			`<b>Return:</b> ${(data.pctChange * 100)?.toFixed(2)}%\n` +
			`<b>Today's P&L:</b> <code class="${todayPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}">$${todayPnl.toFixed(2)}</code>\n` +
			`<b>Exit Price:</b> $${data.exitPrice}\n` +
			`<b>Balance:</b> $${data.balance?.toFixed(2)}`;
	} else if (type === 'goal' && config.notificationOnPnlGoal) {
		shouldNotify = true;
		message =
			`<b>🏆 DAILY GOAL REACHED!</b>\n\n` +
			`<b>Today's P&L:</b> <code class="text-emerald-400">$${data.todayPnl?.toFixed(2)}</code>\n` +
			`<b>Goal:</b> $${data.goal}\n` +
			`<b>Total Trades:</b> ${data.totalTrades}`;
	} else if (type === 'min_pnl') {
		shouldNotify = true;
		message =
			`<b>⚠️ DAILY LOSS LIMIT REACHED</b>\n\n` +
			`<b>Today's P&L:</b> <code class="text-red-400">$${data.todayPnl?.toFixed(2)}</code>\n` +
			`<b>Limit:</b> $${data.min}\n` +
			`<b>Total Trades:</b> ${data.totalTrades}`;
	} else if (type === 'max_pnl') {
		shouldNotify = true;
		message =
			`<b>💰 DAILY PROFIT TARGET REACHED</b>\n\n` +
			`<b>Today's P&L:</b> <code class="text-emerald-400">$${data.todayPnl?.toFixed(2)}</code>\n` +
			`<b>Target:</b> $${data.max}\n` +
			`<b>Total Trades:</b> ${data.totalTrades}`;
	} else if (type === 'error' && config.notificationOnError) {
		shouldNotify = true;
		message =
			`<b>❌ BOT ERROR</b>\n\n` +
			`<b>Service:</b> ${data.service || 'Unknown'}\n` +
			`<b>Error:</b> <code>${data.message || 'Unknown error'}</code>\n` +
			`<b>Context:</b> ${data.context || 'N/A'}`;
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
