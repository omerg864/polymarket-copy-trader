import 'dotenv/config';
import polymarketService from '../src/services/polymarket';
import logger from '../src/utils/logger';

async function main() {
    const conditionId = '0xe6cbd6ead6d63fb36ad189c928e1988fad4a41b7e324a404a40a703b29018236';
    
    logger.info(`🚀 Starting redemption script for conditionId: ${conditionId}`);
    
    try {
        // Initialize polymarket service (loads credentials and setup signer)
        await polymarketService.initialize();
        
        logger.info('⏳ Triggering redemption...');
        
        // This will attempt gasless redemption for indices 1 and 2
        await polymarketService.redeemWinnings(conditionId);
        
        logger.info('✅ Redemption process complete. Check logs above for relayer transaction IDs.');
    } catch (error) {
        logger.error(`❌ Error in redemption script: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    }
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
