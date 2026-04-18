import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', 'btc5-bot', '.env') });

import polymarketService from '../btc5-bot/src/services/polymarket';
import logger from '../btc5-bot/src/utils/logger';

async function main() {
	const conditionId =
		process.argv[2] ||
		'0xe6cbd6ead6d63fb36ad189c928e1988fad4a41b7e324a404a40a703b29018236';

	console.log(`🚀 Starting redemption process via PolymarketService...`);
	console.log(`🆔 conditionId: ${conditionId}`);

	try {
		console.log(`🔌 Initializing PolymarketService...`);
		await polymarketService.initialize();

		console.log(`💰 Attempting redemption...`);
		await polymarketService.redeemWinnings(conditionId);

		console.log(`✅ Redemption attempt finished.`);
		console.log(`ℹ️ Check logs/bot.log for detailed transaction status.`);
	} catch (error) {
		console.error(`❌ Error during redemption:`, error);
	} finally {
		// Small delay to ensure logs are flushed if needed
		setTimeout(() => process.exit(0), 1000);
	}
}

main().catch((error) => {
	console.error('Fatal error:', error);
	process.exit(1);
});
