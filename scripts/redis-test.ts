import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', 'btc5-bot', '.env') });

import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function main() {
    console.log('Connecting to:', REDIS_URL);
	const redis = new Redis(REDIS_URL);
    const testKey = `test:${Date.now()}`;
    await redis.set(testKey, 'hello');
    console.log(`Set ${testKey}`);
    
    const val = await redis.get(testKey);
    console.log(`Value for ${testKey}: ${val}`);

	const keys = await redis.keys('*');
	console.log(`Total keys: ${keys.length}`);
    console.log('Sample keys:', keys.slice(0, 10));

	await redis.quit();
}

main();
