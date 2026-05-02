import polymarketService from '../src/services/polymarket';
import polymarketWsService from '../src/services/polymarketWs';
import logger from '../src/utils/logger';
import { Market } from '@shared/types';

async function testFallback() {
	logger.info('🧪 Starting fallback verification test...');

	const mockMarket: Market = {
		conditionId: '0x123',
		questionId: '0x456',
		slug: 'btc-updown-5m-test',
		eventTicker: 'BTC',
		title: 'BTC 5m test',
		startTime: new Date(),
		endTime: new Date(Date.now() + 300000),
		upTokenId:
			'0x218f2762f025f1873177893092289656094b910b776495d4bdc45b736b7bc189', // Use real-looking token IDs if possible
		downTokenId:
			'0x4f4949174df09859f753556f8f415c8c51121853676aa614da403d5df025fecb',
		tickSize: '0.001',
		negRisk: false,
		minOrderSize: 1,
	};

	// 1. Test with WS active (if possible) - this might return null if not connected
	logger.info(
		'--- Step 1: Testing with WS (may be null if not connected) ---',
	);
	const wsPrices = await polymarketService.getMarketPrices(mockMarket);
	logger.info(`WS Prices: ${JSON.stringify(wsPrices)}`);

	// 2. Force fallback by ensuring WS returns null
	// We can't easily mock polymarketWsService.getPrice without changing the code,
	// but we know it returns null if not connected or started.

	logger.info('--- Step 2: Testing Fallback to Midpoint API ---');
	// Ensure WS is stopped or not started
	polymarketWsService.stop();

	// Test getMarketPrices fallback
	const fallbackPrices = await polymarketService.getMarketPrices(mockMarket);
	if (fallbackPrices && fallbackPrices.upPrice > 0) {
		logger.info('✅ getMarketPrices Fallback successful!');
		logger.info(`Fallback Prices: ${JSON.stringify(fallbackPrices)}`);
	} else {
		logger.error('❌ getMarketPrices Fallback failed');
	}

	// Test getTokenPrice fallback
	const tokenPrice = await polymarketService.getTokenPrice(
		mockMarket.upTokenId,
		mockMarket.conditionId,
		'UP',
	);
	if (tokenPrice && tokenPrice > 0) {
		logger.info(
			`✅ getTokenPrice Fallback successful! Price: ${tokenPrice}`,
		);
	} else {
		logger.error('❌ getTokenPrice Fallback failed');
	}

	process.exit(0);
}

testFallback().catch((err) => {
	logger.error(`Test failed: ${err}`);
	process.exit(1);
});
