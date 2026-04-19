import polymarketService from '../src/services/polymarket';
import config from '../src/config';

async function checkOutcome() {
    const eventTicker = 'btc-updown-5m-1776628500';
    console.log(`Checking outcome for ${eventTicker}...`);
    try {
        const outcome = await polymarketService.getMarketOutcome(eventTicker);
        console.log(`Outcome: ${outcome}`);
    } catch (err) {
        console.error(`Error:`, err);
    }
}

checkOutcome().catch(console.error);
