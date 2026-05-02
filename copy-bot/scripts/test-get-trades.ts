import { PolymarketService } from '../src/services/polymarket';
import config from '../src/config';
import logger from '../src/utils/logger';

async function main() {
    const service = new PolymarketService();
    // Use the internal clobClient if accessible, or initialize a new one
    const clobClient = (service as any).clobClient;
    
    if (!clobClient) {
        console.error("ClobClient not found in service");
        return;
    }

    console.log(`Fetching trades for ${config.funderAddress}...`);
    try {
        const trades = await clobClient.getTrades({ maker_address: config.funderAddress });
        console.log(`Found ${trades.length} trades.`);
        
        const conditionIds = new Set<string>();
        trades.forEach((t: any) => {
            if (t.market) conditionIds.add(t.market);
        });

        console.log("Unique Condition IDs:", Array.from(conditionIds));
    } catch (err) {
        console.error("Error fetching trades:", err);
    }
}

main();
