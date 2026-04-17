
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', 'btc5-bot', '.env') });

async function main() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/polymarket-bot');
    const db = mongoose.connection.db;
    const searchId = process.argv[2];

    if (!searchId) {
        console.error('Please provide a search ID (tradeId, conditionId, or slug)');
        process.exit(1);
    }

    console.log(`🔍 Searching for identifiers matching: ${searchId}...`);

    const trades = await db.collection('trades').find({
        $or: [
            { tradeId: searchId },
            { conditionId: searchId },
            { slug: searchId },
            { tradeId: new RegExp(searchId, 'i') },
            { conditionId: new RegExp(searchId, 'i') }
        ]
    }).toArray();

    if (trades.length === 0) {
        console.log('❌ No trades found in MongoDB.');
    } else {
        console.log(`✅ Found ${trades.length} trade(s):`);
        console.log(JSON.stringify(trades, null, 2));
    }

    await mongoose.disconnect();
}

main().catch(console.error);
