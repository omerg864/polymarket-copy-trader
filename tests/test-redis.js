import { ClobClient } from '@polymarket/clob-client';
import axios from 'axios';

async function test() {
	const clobClient = new ClobClient('https://clob.polymarket.com', 137);
	// Get current active market upTokenId from gamma
	const gammaApi = axios.create({
		baseURL: 'https://gamma-api.polymarket.com',
	});
	const epoch = Math.floor(Date.now() / 1000);
	const fiveMin = 300;
	const currentStart = Math.floor(epoch / fiveMin) * fiveMin;
	const slug = `btc-updown-5m-${currentStart}`;

	const { data: events } = await gammaApi.get('/events', {
		params: { slug },
	});
	const event = events.find((e) => e.slug === slug);
	if (!event) return console.log('no event');
	const market = event.markets[0];
	const tokens = JSON.parse(market.clobTokenIds);

	try {
		console.log('fetching book for', tokens[0]);
		const book = await clobClient.getOrderBook(tokens[0]);
		console.log('Book response keys:', Object.keys(book));
		console.log('Book midpoint:', book.midpoint);
		console.log('Book bids:', book.bids?.length);
		console.log('Book asks:', book.asks?.length);
		console.log('Bid 0:', book.bids?.[0]);
		console.log('Ask 0:', book.asks?.[0]);
	} catch (err) {
		console.error('Error fetching book', err.message);
	}
}

test();
