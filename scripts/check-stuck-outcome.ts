import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', 'copy-bot', '.env') });

import polymarketService from '../copy-bot/src/services/polymarket';
import logger from '../copy-bot/src/utils/logger';

async function main() {
	const slug = 'btc-updown-5m-1776440700'; // From the stuck trade
	console.log(`Checking outcome for slug: ${slug}`);

	const outcome = await polymarketService.getMarketOutcome(slug);
	console.log(`Outcome: ${outcome}`);

	if (outcome === 'UP') {
		console.log(
			'✅ Trade WON! Need to redeem condition 0xc8c9b3cbca1a82afff8b899d6c80bceb37f838767d665c99d86ca0d69c34145f',
		);
	} else if (outcome === 'DOWN') {
		console.log('❌ Trade LOST!');
	} else {
		console.log('⏳ Market not resolved yet or error.');
	}
}

main().catch(console.error);
