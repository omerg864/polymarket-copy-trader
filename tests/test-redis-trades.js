import Redis from 'ioredis';

async function check() {
	const redis = new Redis('redis://localhost:6379');
	const ids = await redis.smembers('pmbot:active_trades');
	console.log(`Active trades count: ${ids.length}`);
	for (const id of ids) {
		const data = await redis.get(`pmbot:trade:${id}`);
		const trade = JSON.parse(data);
		console.log(
			`Trade ${trade.id}: direction=${trade.direction}, entry=${trade.entryPrice}, current=${trade.currentPrice}`,
		);
	}
	process.exit(0);
}
check();
