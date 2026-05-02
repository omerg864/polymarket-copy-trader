import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', 'copy-bot', '.env') });

async function main() {
	const rpcUrl = 'https://polygon-rpc.com';
	const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

	const userAddress = '0xb5637b6692c708b2fe4df77479a893cab62447d2';
	const tokenId =
		'114162452542275862061797834319735533292968273214070635310077599228648873314972';
	const ctfAddress = '0x4d97dcd97ec945f40cf65f87097ace5ea0476045';

	const ctfAbi = [
		'function balanceOf(address account, uint256 id) view returns (uint256)',
	];

	const ctf = new ethers.Contract(ctfAddress, ctfAbi, provider);

	try {
		const balance = await ctf.balanceOf(userAddress, tokenId);
		process.stdout.write(
			`💰 Balance: ${ethers.utils.formatUnits(balance, 6)} tokens\n`,
		);
	} catch (error) {
		process.stderr.write(`❌ Error checking balance: ${error.message}\n`);
	}
}

main().catch(console.error);
