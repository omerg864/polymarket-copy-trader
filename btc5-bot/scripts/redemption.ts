import { encodeFunctionData, prepareEncodeFunctionData, zeroHash } from 'viem';
import {
	Transaction,
	RelayerTxType,
	RelayClient,
} from '@polymarket/builder-relayer-client';
import config from '../src/config';
import { BuilderConfig } from '@polymarket/builder-signing-sdk';
import { createWalletClient, Hex, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygon } from 'viem/chains';

const ctfRedeemAbi = [
	{
		constant: false,
		inputs: [
			{ name: 'collateralToken', type: 'address' },
			{ name: 'parentCollectionId', type: 'bytes32' },
			{ name: 'conditionId', type: 'bytes32' },
			{ name: 'indexSets', type: 'uint256[]' },
		],
		name: 'redeemPositions',
		outputs: [],
		payable: false,
		stateMutability: 'nonpayable',
		type: 'function',
	},
];

const ctf = prepareEncodeFunctionData({
	abi: ctfRedeemAbi,
	functionName: 'redeemPositions',
});

function createCtfRedeemTransaction(
	ctfAddress: string,
	collateralToken: string,
	conditionId: string,
): Transaction {
	const calldata = encodeFunctionData({
		...ctf,
		args: [collateralToken, zeroHash, conditionId, [1, 2]],
	});
	return {
		to: ctfAddress,
		data: calldata,
		value: '0',
	};
}

const builderConfig = new BuilderConfig({
	localBuilderCreds: {
		key: config.builderApiKey,
		secret: config.builderApiSecret,
		passphrase: config.builderApiPassphrase,
	},
});

const account = privateKeyToAccount(config.privateKey as Hex);
const wallet = createWalletClient({
	account,
	chain: polygon,
	transport: http('https://polygon-public.nodies.app'),
});

async function main() {
	// Or initialize with PROXY transaction type
	const proxyClient = new RelayClient(
		'https://relayer-v2.polymarket.com/',
		137,
		wallet,
		builderConfig,
		RelayerTxType.PROXY,
	);

	// Execute the redeem - works with both SAFE and PROXY
	const ctfAddress = '0x4d97dcd97ec945f40cf65f87097ace5ea0476045';
	const usdcAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
	const conditionId =
		'0x3fb5d81122ceee181ffc9f769c16ec1e97c747114daf937c8ee518cc7897aed1'; // Your condition ID

	const redeemTx = createCtfRedeemTransaction(
		ctfAddress,
		usdcAddress,
		conditionId,
	);

	// Using PROXY client
	const proxyResponse = await proxyClient.execute(
		[redeemTx],
		'redeem positions',
	);
	const proxyResult = await proxyResponse.wait();
	console.log('Proxy redeem completed:', proxyResult?.transactionHash);
}

main().catch(console.error);

// await
