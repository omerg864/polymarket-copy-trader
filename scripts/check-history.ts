/**
 * Check recent trade history.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Redis from 'ioredis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
	path: path.resolve(__dirname, '..', 'btc5-bot', '.env.production.local'),
});

const REDIS_URL = process.env.REDIS_URL;

async function main() {
    const redis = new Redis(REDIS_URL!);
    const history = await redis.lrange('pmbot:demo:history', 0, 4);
    
    console.log('--- RECENT HISTORY (Last 5) ---');
    for (const raw of history) {
        const t = JSON.parse(raw);
        console.log(`\nID:        ${t.id}`);
        console.log(`Title:     ${t.title}`);
        console.log(`Status:    ${t.status}`);
        console.log(`PnL:       $${t.pnl.toFixed(2)}`);
        console.log(`Closed At: ${t.closedAt}`);
    }
    await redis.quit();
}

main().catch(console.error);
