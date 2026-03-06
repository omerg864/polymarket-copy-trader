import Redis from 'ioredis';
import config from './config.js';

async function stopBot() {
	const redis = new Redis(config.redisUrl);
	console.log('🛑 Requesting bot to stop...');
	await redis.set('pmbot:state:stop_requested', 'true');
	console.log(
		'✅ Stop requested successfully. The bot will not enter new trades and will exit once the active trades are resolved.',
	);
	process.exit(0);
}

stopBot().catch((err) => {
	console.error('Failed to request stop:', err.message);
	process.exit(1);
});
