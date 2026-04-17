
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { RelayClient } from '@polymarket/builder-relayer-client';
import { BuilderConfig } from '@polymarket/builder-signing-sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', 'btc5-bot', '.env') });

async function main() {
    const transactionId = process.argv[2];
    if (!transactionId) {
        console.error('Please provide a Relayer Transaction ID');
        process.exit(1);
    }

    const chainId = parseInt(process.env.CHAIN_ID || '137');
    const builderApiKey = process.env.POLYMARKET_BUILDER_API_KEY;
    const builderApiSecret = process.env.POLYMARKET_BUILDER_SECRET;
    const builderApiPassphrase = process.env.POLYMARKET_BUILDER_PASSPHRASE;

    const builderConfig = new BuilderConfig({
        localBuilderCreds: {
            key: builderApiKey,
            secret: builderApiSecret,
            passphrase: builderApiPassphrase,
        },
    });

    const relayClient = new RelayClient(
        'https://relayer-v2.polymarket.com/',
        chainId,
        undefined, // no signer needed for read
        builderConfig
    );

    try {
        console.log(`🔍 Checking status for Transaction ID: ${transactionId}...`);
        const transactions = await relayClient.getTransaction(transactionId);
        console.log(`✅ Transaction Details:`, JSON.stringify(transactions, null, 2));
    } catch (error) {
        console.error(`❌ Failed to fetch transaction:`, error);
    }
}

main().catch(console.error);
