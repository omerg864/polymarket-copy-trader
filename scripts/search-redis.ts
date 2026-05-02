import Redis from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', 'copy-bot', '.env') });

async function main() {
	const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
	const pattern = process.argv[2] || '*';
	const keys = await redis.keys(pattern);
	console.log(`Found ${keys.length} keys matching ${pattern}`);

	for (const key of keys) {
		const type = await redis.type(key);
		if (type === 'string') {
			const val = await redis.get(key);
			console.log(`\nKey: ${key} (${type})`);
			console.log(`Value: ${val}`);
		} else {
			console.log(`\nKey: ${key} (${type})`);
		}
	}
	await redis.quit();
}

main().catch(console.error);
