import Redis from 'ioredis';

async function analyze() {
	const client = new Redis();

	try {
		const rawTrades = await client.lrange('pmbot:history', 0, 500);
		const trades = rawTrades.map((t) => JSON.parse(t));

		console.log(`Found ${trades.length} completed trades`);

		if (trades.length === 0) return;

		let wins = 0;
		let totalPnl = 0;
		let totalCost = 0;

		const buckets = {
			entryPrice: {
				'<0.80': { w: 0, l: 0, pnl: 0, wPct: 0, lPct: 0 },
				'0.80-0.85': { w: 0, l: 0, pnl: 0, wPct: 0, lPct: 0 },
				'0.85-0.90': { w: 0, l: 0, pnl: 0, wPct: 0, lPct: 0 },
				'>0.90': { w: 0, l: 0, pnl: 0, wPct: 0, lPct: 0 },
			},
			confidence: {
				'<70%': { w: 0, l: 0, pnl: 0, wPct: 0, lPct: 0 },
				'70-80%': { w: 0, l: 0, pnl: 0, wPct: 0, lPct: 0 },
				'80-90%': { w: 0, l: 0, pnl: 0, wPct: 0, lPct: 0 },
				'>90%': { w: 0, l: 0, pnl: 0, wPct: 0, lPct: 0 },
			},
			marketAgeMinutes: {
				'<1m': { w: 0, l: 0, pnl: 0, wPct: 0, lPct: 0 },
				'1-2m': { w: 0, l: 0, pnl: 0, wPct: 0, lPct: 0 },
				'2-3m': { w: 0, l: 0, pnl: 0, wPct: 0, lPct: 0 },
				'>3m': { w: 0, l: 0, pnl: 0, wPct: 0, lPct: 0 },
			},
			direction: {
				UP: { w: 0, l: 0, pnl: 0, wPct: 0, lPct: 0 },
				DOWN: { w: 0, l: 0, pnl: 0, wPct: 0, lPct: 0 },
			},
		};

		for (const trade of trades) {
			const isWin = trade.pnl > 0;
			if (isWin) wins++;
			totalPnl += trade.pnl;
			totalCost += trade.cost;

			// Entry Price
			const price = trade.entryPrice;
			if (price < 0.8) {
				isWin
					? buckets.entryPrice['<0.80'].w++
					: buckets.entryPrice['<0.80'].l++;
				buckets.entryPrice['<0.80'].pnl += trade.pnl;
				isWin
					? (buckets.entryPrice['<0.80'].wPct += trade.pctChange)
					: (buckets.entryPrice['<0.80'].lPct += trade.pctChange);
			} else if (price < 0.85) {
				isWin
					? buckets.entryPrice['0.80-0.85'].w++
					: buckets.entryPrice['0.80-0.85'].l++;
				buckets.entryPrice['0.80-0.85'].pnl += trade.pnl;
				isWin
					? (buckets.entryPrice['0.80-0.85'].wPct += trade.pctChange)
					: (buckets.entryPrice['0.80-0.85'].lPct += trade.pctChange);
			} else if (price < 0.9) {
				isWin
					? buckets.entryPrice['0.85-0.90'].w++
					: buckets.entryPrice['0.85-0.90'].l++;
				buckets.entryPrice['0.85-0.90'].pnl += trade.pnl;
				isWin
					? (buckets.entryPrice['0.85-0.90'].wPct += trade.pctChange)
					: (buckets.entryPrice['0.85-0.90'].lPct += trade.pctChange);
			} else {
				isWin
					? buckets.entryPrice['>0.90'].w++
					: buckets.entryPrice['>0.90'].l++;
				buckets.entryPrice['>0.90'].pnl += trade.pnl;
				isWin
					? (buckets.entryPrice['>0.90'].wPct += trade.pctChange)
					: (buckets.entryPrice['>0.90'].lPct += trade.pctChange);
			}

			// Confidence
			const conf = trade.confidence || 0;
			if (conf < 0.7) {
				isWin
					? buckets.confidence['<70%'].w++
					: buckets.confidence['<70%'].l++;
				buckets.confidence['<70%'].pnl += trade.pnl;
				isWin
					? (buckets.confidence['<70%'].wPct += trade.pctChange)
					: (buckets.confidence['<70%'].lPct += trade.pctChange);
			} else if (conf < 0.8) {
				isWin
					? buckets.confidence['70-80%'].w++
					: buckets.confidence['70-80%'].l++;
				buckets.confidence['70-80%'].pnl += trade.pnl;
				isWin
					? (buckets.confidence['70-80%'].wPct += trade.pctChange)
					: (buckets.confidence['70-80%'].lPct += trade.pctChange);
			} else if (conf < 0.9) {
				isWin
					? buckets.confidence['80-90%'].w++
					: buckets.confidence['80-90%'].l++;
				buckets.confidence['80-90%'].pnl += trade.pnl;
				isWin
					? (buckets.confidence['80-90%'].wPct += trade.pctChange)
					: (buckets.confidence['80-90%'].lPct += trade.pctChange);
			} else {
				isWin
					? buckets.confidence['>90%'].w++
					: buckets.confidence['>90%'].l++;
				buckets.confidence['>90%'].pnl += trade.pnl;
				isWin
					? (buckets.confidence['>90%'].wPct += trade.pctChange)
					: (buckets.confidence['>90%'].lPct += trade.pctChange);
			}

			// Market Age
			const enteredAt = new Date(trade.enteredAt).getTime();
			const startTime = new Date(trade.startTime).getTime();
			const ageMin = (enteredAt - startTime) / 60000;

			if (ageMin < 1) {
				isWin
					? buckets.marketAgeMinutes['<1m'].w++
					: buckets.marketAgeMinutes['<1m'].l++;
				buckets.marketAgeMinutes['<1m'].pnl += trade.pnl;
				isWin
					? (buckets.marketAgeMinutes['<1m'].wPct += trade.pctChange)
					: (buckets.marketAgeMinutes['<1m'].lPct += trade.pctChange);
			} else if (ageMin < 2) {
				isWin
					? buckets.marketAgeMinutes['1-2m'].w++
					: buckets.marketAgeMinutes['1-2m'].l++;
				buckets.marketAgeMinutes['1-2m'].pnl += trade.pnl;
				isWin
					? (buckets.marketAgeMinutes['1-2m'].wPct += trade.pctChange)
					: (buckets.marketAgeMinutes['1-2m'].lPct +=
							trade.pctChange);
			} else if (ageMin < 3) {
				isWin
					? buckets.marketAgeMinutes['2-3m'].w++
					: buckets.marketAgeMinutes['2-3m'].l++;
				buckets.marketAgeMinutes['2-3m'].pnl += trade.pnl;
				isWin
					? (buckets.marketAgeMinutes['2-3m'].wPct += trade.pctChange)
					: (buckets.marketAgeMinutes['2-3m'].lPct +=
							trade.pctChange);
			} else {
				isWin
					? buckets.marketAgeMinutes['>3m'].w++
					: buckets.marketAgeMinutes['>3m'].l++;
				buckets.marketAgeMinutes['>3m'].pnl += trade.pnl;
				isWin
					? (buckets.marketAgeMinutes['>3m'].wPct += trade.pctChange)
					: (buckets.marketAgeMinutes['>3m'].lPct += trade.pctChange);
			}

			// Direction
			const dir = trade.direction;
			isWin ? buckets.direction[dir].w++ : buckets.direction[dir].l++;
			buckets.direction[dir].pnl += trade.pnl;
			isWin
				? (buckets.direction[dir].wPct += trade.pctChange)
				: (buckets.direction[dir].lPct += trade.pctChange);
		}

		console.log(
			`\nOVERALL: ${wins}/${trades.length} Wins (${((wins / trades.length) * 100).toFixed(1)}%) | Net PNL: $${totalPnl.toFixed(2)} | Total Cost: $${totalCost.toFixed(2)}\n`,
		);

		const printBucket = (name, obj) => {
			console.log(`--- ${name} ---`);
			for (const [k, v] of Object.entries(obj)) {
				const total = v.w + v.l;
				if (total === 0) continue;
				const winRate = ((v.w / total) * 100).toFixed(1);
				const pnlStr =
					v.pnl >= 0
						? `+$${v.pnl.toFixed(2)}`
						: `-$${Math.abs(v.pnl).toFixed(2)}`;
				const avgWinStr =
					v.w > 0 ? `+${((v.wPct / v.w) * 100).toFixed(1)}%` : '0.0%';
				const avgLossStr =
					v.l > 0 ? `${((v.lPct / v.l) * 100).toFixed(1)}%` : '0.0%';
				console.log(
					`${k.padEnd(10)}: ${winRate}% WR (${v.w}W / ${v.l}L) | PNL: ${pnlStr.padEnd(8)} | Avg W: ${avgWinStr.padEnd(6)} Avg L: ${avgLossStr.padEnd(6)} [${total} trades]`,
				);
			}
			console.log('');
		};

		printBucket('Entry Price', buckets.entryPrice);
		printBucket('Confidence', buckets.confidence);
		printBucket('Market Age', buckets.marketAgeMinutes);
		printBucket('Direction', buckets.direction);
	} finally {
		await client.quit();
	}
}

analyze().catch(console.error);
