import config from '../config';

export class TelegramService {
	private static readonly API_URL = `https://api.telegram.org/bot${config.telegramBotToken}`;

	static async sendMessage(chatId: string, text: string) {
		if (!config.telegramBotToken) {
			console.warn('Telegram token not configured, skipping message');
			return;
		}

		try {
			const response = await fetch(`${this.API_URL}/sendMessage`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					chat_id: chatId,
					text,
					parse_mode: 'HTML',
				}),
			});

			if (!response.ok) {
				const errorData = await response.json();
				console.error('Telegram API error:', errorData);
				throw new Error(`Failed to send telegram message: ${response.statusText}`);
			}
		} catch (error) {
			console.error('Telegram service error:', error);
			throw error;
		}
	}

	static async broadcast(chatIds: string[], text: string) {
		await Promise.allSettled(
			chatIds.map((chatId) => this.sendMessage(chatId, text))
		);
	}
}
