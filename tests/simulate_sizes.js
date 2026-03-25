import Redis from 'ioredis';

async function simulate() {
	const client = new Redis();

	try {
		// Fetch original trades
		const rawTrades = await client.lrange('pmbot:history', 0, 500);
		const trades = rawTrades.map((t) => JSON.parse(t));

		console.log(`Found ${trades.length} completed trades`);
		if (trades.length === 0) return;

		// Parameters
		const config = {
			minConfidence: 73,
			minOrderSizeUsd: 20, // NEW
			maxOrderSizeUsd: 50, // NEW
			highPriceThreshold: 0.9,
			highPriceMaxBonusPct: 1.0,
			minOrderSize: 5,
		};

		let wins = 0;
		let oldTotalPnl = 0;
		let newTotalPnl = 0;
		let oldTotalCost = 0;
		let newTotalCost = 0;

		for (const trade of trades) {
			const isWin = trade.pnl > 0;
			if (isWin) wins++;

			// Recreate sizing logic
			const price = trade.entryPrice;
			const confidence = trade.confidence || 0.73; // fallback (0-1)
			const confidencePct = confidence * 100;
			const confidenceRange = 100 - config.minConfidence;
			const confidenceRatio =
				confidenceRange > 0
					? Math.max(
							0,
							(confidencePct - config.minConfidence) /
								confidenceRange,
						)
					: 0;

			const orderBudgetBase =
				config.minOrderSizeUsd +
				confidenceRatio *
					(config.maxOrderSizeUsd - config.minOrderSizeUsd);

			let orderBudget = orderBudgetBase;
			let multiplier = 1.0;
			if (price >= config.highPriceThreshold) {
				const range = 1.0 - config.highPriceThreshold;
				const progress = (price - config.highPriceThreshold) / range;
				multiplier = 1.0 + progress * config.highPriceMaxBonusPct;
				orderBudget = orderBudgetBase * multiplier;
			}

			const newSize = Math.max(
				config.minOrderSize,
				Math.floor(orderBudget / price),
			);
			const newCost = newSize * price;
			const newPnl =
				newCost * (trade.pctChange || trade.pnl / trade.cost); // fallback if pctChange is missing

			oldTotalPnl += trade.pnl;
			oldTotalCost += trade.cost;

			newTotalPnl += newPnl;
			newTotalCost += newCost;
		}

		console.log(`\n--- SIMULATION RESULTS (MIN 20 / MAX 50) ---`);
		console.log(
			`Trades Analyzed: ${trades.length} (${wins} Wins / ${trades.length - wins} Losses, ${((wins / trades.length) * 100).toFixed(1)}% WR)`,
		);
		console.log(`\nOLD SYSTEM (Min 10 / Max 25):`);
		console.log(`  Total Invested: $${oldTotalCost.toFixed(2)}`);
		console.log(
			`  Net P&L:        ${oldTotalPnl >= 0 ? '+' : ''}$${oldTotalPnl.toFixed(2)}`,
		);
		const oldRoi = (oldTotalPnl / oldTotalCost) * 100;
		console.log(
			`  ROI:            ${oldRoi >= 0 ? '+' : ''}${oldRoi.toFixed(2)}%`,
		);

		console.log(`\nNEW SYSTEM (Min 20 / Max 50):`);
		console.log(`  Total Invested: $${newTotalCost.toFixed(2)}`);
		console.log(
			`  Net P&L:        ${newTotalPnl >= 0 ? '+' : ''}$${newTotalPnl.toFixed(2)}`,
		);
		const newRoi = (newTotalPnl / newTotalCost) * 100;
		console.log(
			`  ROI:            ${newRoi >= 0 ? '+' : ''}${newRoi.toFixed(2)}%`,
		);

		console.log(
			`\nDifference in Net Profit: ${newTotalPnl - oldTotalPnl >= 0 ? '+' : ''}$${(newTotalPnl - oldTotalPnl).toFixed(2)}`,
		);
	} finally {
		await client.quit();
	}
}

simulate().catch(console.error);
