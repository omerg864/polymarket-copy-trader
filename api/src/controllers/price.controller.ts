import type { Request, Response } from 'express';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
// @ts-ignore
import FreeProxy from 'free-proxy';

const proxyManager = new FreeProxy();

export async function getCandles(req: Request, res: Response): Promise<void> {
	const {
		startTime,
		endTime,
		interval = '5m',
		symbol = 'BTCUSDT',
	} = req.query;

	const fetchBatch = async (
		start: string | undefined,
		end: string | undefined,
	) => {
		const url = new URL('https://api.binance.com/api/v3/klines');
		url.searchParams.append('symbol', symbol as string);
		url.searchParams.append('interval', interval as string);
		if (start) url.searchParams.append('startTime', start);
		if (end) url.searchParams.append('endTime', end);
		url.searchParams.append('limit', '1000');

		// First try direct fetch
		try {
			const response = await fetch(url.toString());
			if (response.ok) {
				return (await response.json()) as any[][];
			}
			if (response.status !== 451 && response.status !== 403) {
				const errorText = await response.text();
				throw new Error(`Binance API error: ${response.status} ${errorText}`);
			}
			console.warn(`Direct access restricted (Status ${response.status}). Attempting via proxy...`);
		} catch (err: any) {
			if (!err.message.includes('restricted') && !err.message.includes('451') && !err.message.includes('403')) {
				throw err;
			}
			console.warn(`Direct fetch failed: ${err.message}. Attempting via proxy...`);
		}

		// Try with proxies
		try {
			const proxies = await proxyManager.get();
			// Randomize and limit to 10 attempts
			const shuffled = proxies.sort(() => 0.5 - Math.random()).slice(0, 10);

			for (const p of shuffled) {
				try {
					const proxyUrl = `http://${p.ip}:${p.port}`;
					console.log(`Trying proxy: ${proxyUrl}`);
					const agent = new HttpsProxyAgent(proxyUrl);
					
					const response = await axios.get(url.toString(), {
						httpsAgent: agent,
						timeout: 8000,
						proxy: false,
						headers: {
							'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
						}
					});

					if (response.status === 200) {
						console.log(`Successfully fetched via proxy: ${proxyUrl}`);
						return response.data as any[][];
					}
				} catch (proxyErr: any) {
					console.warn(`Proxy ${p.ip}:${p.port} failed: ${proxyErr.message}`);
				}
			}
		} catch (err: any) {
			console.error('Error fetching proxies:', err);
		}

		throw new Error('Binance API restricted and all proxies failed');
	};

	try {
		let allData: any[][] = [];
		let currentStartTime = startTime as string | undefined;
		const targetEndTime = endTime
			? parseInt(endTime as string, 10)
			: Date.now();
		const maxPages = 3;

		for (let i = 0; i < maxPages; i++) {
			const batch = await fetchBatch(
				currentStartTime,
				endTime as string | undefined,
			);
			if (batch.length === 0) break;

			allData = [...allData, ...batch];

			// If we got fewer than 1000, we reached the end of the available data in the range
			if (batch.length < 1000) break;

			// Prepare next start time (1ms after last candle's open time)
			const lastCandleTime = batch[batch.length - 1][0] as number;
			currentStartTime = (lastCandleTime + 1).toString();

			// If our next start time is already beyond our target end time, stop
			if (parseInt(currentStartTime, 10) >= targetEndTime) break;
		}

		// Remove potential duplicates by openTime (Binance might overlap if not careful)
		const uniqueData = Array.from(
			new Map(allData.map((c) => [c[0], c])).values(),
		);

		const candles = uniqueData.map((c) => ({
			time: Math.floor((c[0] as number) / 1000), // convert to seconds for lightweight-charts
			open: parseFloat(c[1] as string),
			high: parseFloat(c[2] as string),
			low: parseFloat(c[3] as string),
			close: parseFloat(c[4] as string),
			volume: parseFloat(c[5] as string),
		}));

		res.json(candles);
	} catch (error) {
		console.error('Error fetching candles:', error);
		res.status(500).json({ error: 'Failed to fetch candlestick data' });
	}
}
