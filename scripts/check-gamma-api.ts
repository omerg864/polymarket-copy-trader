/**
 * Check Gamma API directly for market resolution.
 */
import axios from 'axios';

const GAMMA_HOST = 'https://gamma-api.polymarket.com';
const SLUGS = [
	'btc-updown-5m-1744040700', // 15:45 ET
	'btc-updown-5m-1744041000', // 15:50 ET
    'btc-updown-5m-1744041600', // 16:00 ET
    'btc-updown-5m-1744042500', // 16:15 ET
];

// Wait, I should use the actual slugs from the investigation output
// 1. btc-updown-5m-1775504700
// 2. btc-updown-5m-1775505000
// 3. btc-updown-5m-1775505600
// 4. btc-updown-5m-1775506500

const ACTUAL_SLUGS = [
    'btc-updown-5m-1775504700',
    'btc-updown-5m-1775505000',
    'btc-updown-5m-1775505600',
    'btc-updown-5m-1775506500'
];

async function main() {
    for (const slug of ACTUAL_SLUGS) {
        console.log(`\n🔍 Checking slug: ${slug}`);
        try {
            const response = await axios.get(`${GAMMA_HOST}/events`, {
                params: { slug }
            });
            const event = response.data?.[0];
            if (!event) {
                console.log('❌ Event not found');
                continue;
            }
            console.log(`  Title:  ${event.title}`);
            console.log(`  Closed: ${event.closed}`);
            
            const market = event.markets?.[0];
            if (!market) {
                console.log('❌ Market not found in event');
                continue;
            }
            console.log(`  Market Closed: ${market.closed}`);
            console.log(`  Outcome Prices: ${market.outcomePrices}`);
        } catch (err: any) {
            console.error(`❌ Error checking slug: ${err.message}`);
        }
    }
}

main().catch(console.error);
