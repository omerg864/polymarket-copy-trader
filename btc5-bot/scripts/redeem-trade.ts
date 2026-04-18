import 'dotenv/config';
import polymarketService from '../src/services/polymarket';
import logger from '../src/utils/logger';

async function main() {
    const conditionId = process.argv[2] || '0x3fb5d81122ceee181ffc9f769c16ec1e97c747114daf937c8ee518cc7897aed1';
    
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
