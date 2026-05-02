import 'dotenv/config';
import { ethers, BigNumber } from 'ethers';
import config from '../src/config';

const CTF_ADDRESS = '0x4d97dcd97ec945f40cf65f87097ace5ea0476045';
const NEG_RISK_ADAPTER_ADDRESS = '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296';
const USDC_ADDRESS = '0x2791bca1f2de4661ed88a30c99a7a9449aa84174';

const CTF_ABI = [
    "function payoutDenominator(bytes32 conditionId) view returns (uint256)",
    "function payoutNumerators(bytes32 conditionId, uint256 index) view returns (uint256)",
    "function balanceOf(address account, uint256 id) view returns (uint256)",
    "function getCollectionId(bytes32 parentCollectionId, bytes32 conditionId, uint256 indexSet) view returns (bytes32)",
    "function getPositionId(address collateralToken, bytes32 collectionId) view returns (uint256)"
];

async function main() {
    const conditionId = process.argv[2] || '0xe6cbd6ead6d63fb36ad189c928e1988fad4a41b7e324a404a40a703b29018236';
    const provider = new ethers.providers.StaticJsonRpcProvider('https://rpc.ankr.com/polygon', 137);
    const ctf = new ethers.Contract(CTF_ADDRESS, CTF_ABI, provider);

    console.log(`\n🔍 DIAGNOSING CONDITION: ${conditionId}`);

    try {
        const denom: BigNumber = await ctf.payoutDenominator(conditionId);
        console.log(`📊 Payout Denominator: ${denom.toString()}`);

        if (denom.isZero()) {
            console.log('❌ Market NOT resolved on-chain yet.');
        } else {
            console.log('✅ Market IS resolved on-chain.');
            
            const [num0, num1] = await Promise.all([
                ctf.payoutNumerators(conditionId, 0),
                ctf.payoutNumerators(conditionId, 1)
            ]);
            console.log(`🏆 Payout Numerator 0: ${num0.toString()}`);
            console.log(`🏆 Payout Numerator 1: ${num1.toString()}`);
            
            // Check balances for the funder
            const funder = config.funderAddress;
            console.log(`👛 Checking balances for funder: ${funder}`);

            for (let i = 0; i < 2; i++) {
                const indexSet = i === 0 ? 1 : 2;
                const collectionId = await ctf.getCollectionId(
                    '0x0000000000000000000000000000000000000000000000000000000000000000',
                    conditionId,
                    indexSet
                );
                const tokenId = await ctf.getPositionId(USDC_ADDRESS, collectionId);
                const balance = await ctf.balanceOf(funder, tokenId);
                console.log(`   Token ${i} (ID: ${tokenId.toString()}): ${ethers.utils.formatUnits(balance, 6)} tokens`);
            }
        }
    } catch (error) {
        console.error('❌ Error during diagnosis:', error);
    }
}

main();
