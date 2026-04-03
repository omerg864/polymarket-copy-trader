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
	getDailyStats,
	getStopRequested,
} from '../services/redis';
import { DateTime } from 'luxon';
import { getStrategyConfig } from '../services/strategyConfig';
import { TelegramService } from '../services/telegram';
import config from '../config';
import {
	addAuthenticatedChatId,
	isAuthenticatedChatId,
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

	const isAuth = await isAuthenticatedChatId(chatId);
	const isAuthCmd = text.startsWith('/authenticate') || text === '/start';

	if (!isAuth && !isAuthCmd) {
		await TelegramService.sendMessage(
			chatId,
			'🔒 <b>Access Denied</b>\nThis bot is private. Please use <code>/authenticate &lt;password&gt;</code> to gain access.',
		);
		res.sendStatus(200);
		return;
	}

	if (text === '/start') {
		const welcomeMessage =
			`👋 <b>Welcome to Polymarket Trading Bot!</b>\n\n` +
			`This bot provides real-time notifications and statistics for BTC 5-minute markets.\n\n` +
			`<b>Commands:</b>\n` +
			`/start - Show this summary\n` +
			`/authenticate &lt;password&gt; - Gain access to the bot\n` +
			`/subscribe - Enable trade notifications\n` +
			`/unsubscribe - Disable notifications\n` +
			`/stats - Current performance summary\n` +
			`/active - View details of open trades\n\n` +
			`⚠️ <b>Note:</b> You must authenticate first before using most commands.`;

		await TelegramService.sendMessage(chatId, welcomeMessage);
	} else if (text.startsWith('/authenticate')) {
		const parts = text.split(' ');
		const password = parts[1];

		if (
			password === config.adminPassword ||
			password === config.readonlyPassword
		) {
			await addAuthenticatedChatId(chatId);
			await TelegramService.sendMessage(
				chatId,
				'✅ <b>Authentication Successful!</b>\nYou now have access to all bot commands.',
			);
		} else {
			await TelegramService.sendMessage(
				chatId,
				'❌ <b>Invalid Password</b>\nPlease try again with <code>/authenticate &lt;password&gt;</code>.',
			);
		}
	} else if (text === '/subscribe') {
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
		const todayStats = await getDailyStats(todayStr);
		const winRate =
			stats.totalTrades > 0
				? ((stats.wins / stats.totalTrades) * 100).toFixed(1)
				: '0.0';

		const todayWinRate =
			todayStats.wins + todayStats.losses > 0
				? (
						(todayStats.wins / (todayStats.wins + todayStats.losses)) *
						100
					).toFixed(1)
				: '0.0';

		const uptime = botStartTime
			? Math.floor((Date.now() - botStartTime) / (1000 * 60 * 60))
			: 0;

		const statsMessage =
			`<b>📊 Bot Statistics</b>\n\n` +
			`<b>Balance:</b> <code class="text-emerald-400">$${balance.toFixed(2)}</code>\n` +
			`<b>Initial:</b> $${strategyConfig.botAllowance.toFixed(2)}\n` +
			`<b>Today's P&L:</b> <code class="${todayStats.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}">$${todayStats.pnl.toFixed(2)}</code>\n` +
			`<b>Today's Trades:</b> ${todayStats.wins + todayStats.losses} (${todayStats.wins}W / ${todayStats.losses}L) - ${todayWinRate}%\n` +
			`<b>Total P&L:</b> <code class="${stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}">$${stats.totalPnl.toFixed(2)}</code>\n` +
			`<b>Total Win Rate:</b> ${winRate}%\n` +
			`<b>Total Trades:</b> ${stats.totalTrades} (${stats.wins}W / ${stats.losses}L)\n` +
			`<b>Active Trades:</b> ${activeTrades.length}\n` +
			`<b>Uptime:</b> ${uptime} hours\n` +
			`<b>Status:</b> ${isStopping ? '🛑 Stopping' : '🏃 Running'}`;

		await TelegramService.sendMessage(chatId, statsMessage);
	} else if (text === '/active') {
		const activeTrades = await getActiveTrades();

		if (activeTrades.length === 0) {
			await TelegramService.sendMessage(
				chatId,
				'<b>ℹ️ No active trades at the moment.</b>',
			);
			res.sendStatus(200);
			return;
		}

		let activeMessage = `<b>🕒 Active Trades (${activeTrades.length})</b>\n`;
		for (const t of activeTrades) {
			const dirEmoji = t.direction === 'UP' ? '↑' : '↓';
			const entryTime = t.enteredAt
				? DateTime.fromISO(t.enteredAt).toFormat('HH:mm')
				: 'N/A';
			const pctChange =
				t.entryPrice > 0
					? ((t.currentPrice - t.entryPrice) / t.entryPrice) * 100
					: 0;
			const marketName =
				t.title?.replace('Bitcoin Up or Down - ', '') || 'Trade';

			activeMessage +=
				`\n<b>${dirEmoji} ${marketName}</b>` +
				`\n• <b>Entered:</b> ${entryTime}` +
				`\n• <b>Size:</b> ${t.size.toLocaleString()} shares` +
				`\n• <b>Entry:</b> $${t.entryPrice.toFixed(3)}` +
				`\n• <b>Cost:</b> $${t.cost.toFixed(2)}` +
				`\n• <b>Change:</b> <code class="${pctChange >= 0 ? 'text-emerald-400' : 'text-red-400'}">${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}%</code>` +
				`\n• <b>Conf:</b> ${(t.confidence ? t.confidence * 100 : 0).toFixed(1)}%\n`;
		}

		await TelegramService.sendMessage(chatId, activeMessage);
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

	if (type === 'trade' && config.notificationOnTrade) {
		shouldNotify = true;
		message =
			`<b>🆕 TRADE OPENED</b>\n\n` +
			`<b>Market:</b> ${data.title || 'Unknown'}\n` +
			`<b>Direction:</b> ${data.direction === 'UP' ? '↑ UP' : '↓ DOWN'}\n` +
			`<b>Size:</b> ${data.size.toLocaleString()} shares\n` +
			`<b>Entry Price:</b> $${data.entryPrice}\n` +
			`<b>Confidence:</b> ${(data.confidence * 100).toFixed(1)}%`;
	} else if (type === 'win') {
		const isTp = data.status === 'closed_tp';
		const isWon = data.status === 'won' || !data.status;
		const canNotify =
			(isTp && config.notificationOnTp) ||
			(isWon && config.notificationOnWon);

		if (canNotify) {
			const statusText = isTp ? 'Take Profit' : 'Win';
			const todayPnl = data.todayPnl ?? 0;
			const todayWins = data.todayWins ?? 0;
			const todayLosses = data.todayLosses ?? 0;
			const todayTotal = todayWins + todayLosses;
			const todayWinRate =
				todayTotal > 0 ? ((todayWins / todayTotal) * 100).toFixed(1) : '0.0';

			shouldNotify = true;
			message =
				`<b>🚀 NEW WIN!</b>\n\n` +
				`<b>Market:</b> ${data.title || 'Unknown'}\n` +
				`<b>Result:</b> ${statusText}\n` +
				`<b>Profit:</b> <code class="text-emerald-400">$${data.pnl?.toFixed(2)}</code>\n` +
				`<b>Return:</b> ${(data.pctChange * 100)?.toFixed(2)}%\n` +
				`<b>Today's P&L:</b> <code class="${todayPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}">$${todayPnl.toFixed(2)}</code>\n` +
				`<b>Today's Stats:</b> ${todayWins}W / ${todayLosses}L (${todayWinRate}%)\n` +
				`<b>Exit Price:</b> $${data.exitPrice}\n` +
				`<b>Balance:</b> $${data.balance?.toFixed(2)}`;
		}
	} else if (type === 'loss') {
		const isSl = data.status === 'closed_sl';
		const isFct = data.status === 'closed_fct';
		const isLost = data.status === 'lost' || !data.status;
		const canNotify =
			(isSl && config.notificationOnSl) ||
			(isFct && config.notificationOnFct) ||
			(isLost && config.notificationOnLost);

		if (canNotify) {
			const statusText = isSl
				? 'Stop Loss'
				: isFct
					? 'Forced Closure'
					: 'Loss';
			const todayPnl = data.todayPnl ?? 0;
			const todayWins = data.todayWins ?? 0;
			const todayLosses = data.todayLosses ?? 0;
			const todayTotal = todayWins + todayLosses;
			const todayWinRate =
				todayTotal > 0 ? ((todayWins / todayTotal) * 100).toFixed(1) : '0.0';

			shouldNotify = true;
			message =
				`<b>📉 Trade Loss</b>\n\n` +
				`<b>Market:</b> ${data.title || 'Unknown'}\n` +
				`<b>Result:</b> ${statusText}\n` +
				`<b>Loss:</b> <code class="text-red-400">$${Math.abs(data.pnl)?.toFixed(2)}</code>\n` +
				`<b>Return:</b> ${(data.pctChange * 100)?.toFixed(2)}%\n` +
				`<b>Today's P&L:</b> <code class="${todayPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}">$${todayPnl.toFixed(2)}</code>\n` +
				`<b>Today's Stats:</b> ${todayWins}W / ${todayLosses}L (${todayWinRate}%)\n` +
				`<b>Exit Price:</b> $${data.exitPrice}\n` +
				`<b>Balance:</b> $${data.balance?.toFixed(2)}`;
		}
	} else if (type === 'goal' && config.notificationOnPnlGoal) {
		const todayWins = data.todayWins ?? 0;
		const todayLosses = data.todayLosses ?? 0;
		const todayTotal = todayWins + todayLosses;
		const todayWinRate =
			todayTotal > 0 ? ((todayWins / todayTotal) * 100).toFixed(1) : '0.0';

		shouldNotify = true;
		message =
			`<b>🏆 DAILY GOAL REACHED!</b>\n\n` +
			`<b>Today's P&L:</b> <code class="text-emerald-400">$${data.todayPnl?.toFixed(2)}</code>\n` +
			`<b>Today's Stats:</b> ${todayWins}W / ${todayLosses}L (${todayWinRate}%)\n` +
			`<b>Goal:</b> $${data.goal}\n` +
			`<b>Bot Total Trades:</b> ${data.totalTrades}`;
	} else if (type === 'min_pnl') {
		const todayWins = data.todayWins ?? 0;
		const todayLosses = data.todayLosses ?? 0;
		const todayTotal = todayWins + todayLosses;
		const todayWinRate =
			todayTotal > 0 ? ((todayWins / todayTotal) * 100).toFixed(1) : '0.0';

		shouldNotify = true;
		message =
			`<b>⚠️ DAILY LOSS LIMIT REACHED</b>\n\n` +
			`<b>Today's P&L:</b> <code class="text-red-400">$${data.todayPnl?.toFixed(2)}</code>\n` +
			`<b>Today's Stats:</b> ${todayWins}W / ${todayLosses}L (${todayWinRate}%)\n` +
			`<b>Limit:</b> $${data.min}\n` +
			`<b>Bot Total Trades:</b> ${data.totalTrades}`;
	} else if (type === 'max_pnl') {
		const todayWins = data.todayWins ?? 0;
		const todayLosses = data.todayLosses ?? 0;
		const todayTotal = todayWins + todayLosses;
		const todayWinRate =
			todayTotal > 0 ? ((todayWins / todayTotal) * 100).toFixed(1) : '0.0';

		shouldNotify = true;
		message =
			`<b>💰 DAILY PROFIT TARGET REACHED</b>\n\n` +
			`<b>Today's P&L:</b> <code class="text-emerald-400">$${data.todayPnl?.toFixed(2)}</code>\n` +
			`<b>Today's Stats:</b> ${todayWins}W / ${todayLosses}L (${todayWinRate}%)\n` +
			`<b>Target:</b> $${data.max}\n` +
			`<b>Bot Total Trades:</b> ${data.totalTrades}`;
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
