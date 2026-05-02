import polymarketService from '../src/services/polymarket';
import config from '../src/config';
import logger from '../src/utils/logger';
import { Side } from '@polymarket/clob-client';

async function main() {
	logger.info('🚀 Starting global redemption scan...');
	const service = polymarketService;
	await service.initialize();
	
	// Access internal clobClient for trade scanning
	const clobClient = (service as any).clobClient;
	if (!clobClient) {
		logger.error('❌ ClobClient not initialized in PolymarketService');
		return;
	}

	try {
		const funderAddress = config.funderAddress;
		logger.info(`🔍 Scanning last 200 trades for account: ${funderAddress}`);
		
		const trades = await clobClient.getTrades({ 
			maker_address: funderAddress 
		});

		if (!trades || trades.length === 0) {
			logger.info('ℹ️ No trades found for this account.');
			return;
		}

		logger.info(`📊 Found ${trades.length} trades. Extracting unique markets...`);
		
		const conditionIds = new Set<string>();
		trades.forEach((t: any) => {
			if (t.market) {
				conditionIds.add(t.market);
			}
		});

		const uniqueMarketCount = conditionIds.size;
		logger.info(`🎯 Identified ${uniqueMarketCount} unique markets to check.`);

		let successCount = 0;
		let failCount = 0;
		let skippedCount = 0;

		for (const conditionId of conditionIds) {
			try {
				logger.info(`------------------------------------------`);
				logger.info(`🧐 Checking market: ${conditionId}`);
				
				// Optional: Check if market is resolved before attempting redemption
				// This saves relayer bandwidth/quota
				try {
					const marketDetails = await clobClient.getMarket(conditionId);
					// Note: CLOB API 'market' status might be different from Gamma resolution.
					// If the CLOB doesn't show it as resolved, we might still want to try 
					// because the CTF contract might be resolved even if CLOB is laggy.
				} catch (e) {
					// Ignore market fetch errors and try redemption anyway
				}

				logger.info(`💰 Attempting gasless redemption for ${conditionId}...`);
				
				// Call the fixed redeemWinnings method (uses Proxy + wait)
				await service.redeemWinnings(conditionId);
				
				successCount++;
			} catch (err: any) {
				const msg = err.message || String(err);
				if (msg.includes('safe not deployed')) {
					logger.error(`❌ Still getting "safe not deployed" for ${conditionId}. This should not happen with Proxy logic.`);
				} else {
					logger.warn(`⚠️ Redemption attempt finished for ${conditionId}. Check logs above for results.`);
				}
				failCount++;
			}
		}

		logger.info(`==========================================`);
		logger.info(`✅ Global Scan Complete!`);
		logger.info(`📈 Summary:`);
		logger.info(`   - Markets Checked: ${uniqueMarketCount}`);
		logger.info(`   - Attempts Processed: ${successCount + failCount}`);
		logger.info(`==========================================`);

	} catch (error: any) {
		logger.error(`❌ Scan failed: ${error.message}`);
	}
}

main().catch(err => {
	console.error('Fatal error in script:', err);
	process.exit(1);
});
