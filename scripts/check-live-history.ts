
import Redis from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', 'btc5-bot', '.env') });

async function main() {
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    const history = await redis.lrange('pmbot:live:history', 0, 10);
    
    console.log('--- LIVE HISTORY (Last 10) ---');
    for (const raw of history) {
        const t = JSON.parse(raw);
        console.log(`\nID:        ${t.id}`);
        console.log(`Title:     ${t.title}`);
        console.log(`Status:    ${t.status}`);
        console.log(`PnL:       $${t.pnl?.toFixed(4) || 0}`);
        console.log(`Condition: ${t.conditionId}`);
        console.log(`Closed At: ${t.closedAt}`);
    }
    await redis.quit();
}

main().catch(console.error);
