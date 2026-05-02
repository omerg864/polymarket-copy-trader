import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Wallet, ethers } from 'ethers';
import { RelayClient, RelayerTxType } from '@polymarket/builder-relayer-client';
import { BuilderConfig } from '@polymarket/builder-signing-sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', 'copy-bot', '.env') });

async function main() {
	const conditionId =
		'0xe6cbd6ead6d63fb36ad189c928e1988fad4a41b7e324a404a40a703b29018236';

	console.log(
		`🚀 Attempting SPLIT gasless redemption for condition: ${conditionId}...`,
	);

	const privateKey = process.env.PRIVATE_KEY;
	const chainId = parseInt(process.env.CHAIN_ID || '137');
	const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';

	const builderApiKey = process.env.POLYMARKET_BUILDER_API_KEY;
	const builderApiSecret = process.env.POLYMARKET_BUILDER_SECRET;
	const builderApiPassphrase = process.env.POLYMARKET_BUILDER_PASSPHRASE;

	if (!privateKey || !builderApiKey) {
		console.error(
			'❌ Missing required environment variables (PRIVATE_KEY or BUILDER_API_KEY)',
		);
		process.exit(1);
	}

	const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
	const signer = new Wallet(privateKey, provider);

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
		signer,
		builderConfig,
		RelayerTxType.PROXY,
	);

	const ctfAddress = '0x4d97dcd97ec945f40cf65f87097ace5ea0476045';
	const usdcAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';

	// CTF Interface for redeemPositions
	const ctfInterface = new ethers.utils.Interface([
		'function redeemPositions(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] indexSets)',
	]);

	const indexSets = [1, 2];

	for (const index of indexSets) {
		console.log(`📡 Submitting redemption for outcome index ${index}...`);
		const txData = ctfInterface.encodeFunctionData('redeemPositions', [
			usdcAddress,
			'0x0000000000000000000000000000000000000000000000000000000000000000', // parentId
			conditionId,
			[index],
		]);

		try {
			const response = await relayClient.execute([
				{
					to: ethers.utils.getAddress(ctfAddress),
					data: txData,
					value: '0',
				},
			]);
			console.log(
				`✅ Redemption for index ${index} submitted successfully!`,
			);
			console.log(`🔗 Transaction ID:`, response.transactionID);

			console.log(`⏳ Waiting for transaction to be mined...`);
			const result = await relayClient.pollUntilState(
				response.transactionID,
				['STATE_MINED', 'STATE_CONFIRMED'],
				'STATE_FAILED',
				20, // maxPolls
				3000, // pollFrequency ms
			);

			if (result) {
				console.log(`✨ Transaction reached state: ${result.state}`);
				console.log(`🔗 Hash: ${result.transactionHash}`);
			} else {
				console.log(`⚠️ Transaction failed or timed out.`);
			}
		} catch (error) {
			console.error(`❌ Failed to redeem index ${index}:`, error);
		}
	}
}

main().catch(console.error);
