import polymarketService from '../src/services/polymarket';
import logger from '../src/utils/logger';
import config from '../src/config';

async function main() {
	process.env.MODE = 'live'; // Force live mode for this test

	console.log('🚀 Initializing Polymarket Service in LIVE mode...');
	try {
		await polymarketService.initialize();
	} catch (err) {
		console.error(
			'Initialization failed. Make sure your .env is set up correctly for LIVE mode.',
		);
		console.error(err);
		return;
	}

	console.log('🔍 Finding an active market to get a real token ID...');
	const market = await polymarketService.getNextMarket();
	if (!market) {
		console.error('❌ No active markets found. Cannot run test.');
		return;
	}

	// Use a real token ID from the active market
	const dummyTokenId = market.upTokenId;
	const price = 0.5;
	const size = 6;
	const orderMarket = {
		tickSize: market.tickSize,
		negRisk: market.negRisk,
		endTime: market.endTime,
	};

	console.log(`📡 Found market: ${market.title}`);
	console.log(`📡 Attempting to sell ${size} of REAL TOKEN ${dummyTokenId} at ${price}...`);
	console.log("This should now trigger the 'insufficient balance' error and our retry logic.");

	try {
		const order = await polymarketService.placeSellOrder(
			dummyTokenId,
			price,
			size,
			orderMarket,
		);
		if (order) {
			console.log(
				'✅ Order processed (SUCCESSFUL RETRY or unexpected balance)',
			);
			console.log(JSON.stringify(order, null, 2));
		} else {
			console.log('❌ Order failed (returned null)');
		}
	} catch (err: any) {
		console.error('💥 CAUGHT TOP LEVEL ERROR:');
		// The error response structure can vary, so we log multiple possible paths
		const errorData = err.response?.data || err.data || err;
		console.log('FULL ERROR STRUCTURE:', JSON.stringify(errorData, null, 2));
	}
}

main().catch(console.error);
