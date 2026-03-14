import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', 'btc5-bot', '.env') });

import polymarketService from '../btc5-bot/src/services/polymarket';

async function main() {
    const ticker = 'btc-updown-5m-1773492600';
    console.log(`Checking resolution for: ${ticker}`);
    
    // Initialize if needed (though getMarketOutcome uses Axios)
    const winner = await polymarketService.getMarketOutcome(ticker);
    console.log(`Result from Gamma API: ${winner || 'NULL (Not yet resolved)'}`);
}

main().catch(console.error);
