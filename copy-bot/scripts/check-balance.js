const { ethers } = require('ethers');

const funder = '0xb5637b6692c708b2fe4df77479a893cab62447d2';
const conditionId = '0x3fb5d81122ceee181ffc9f769c16ec1e97c747114daf937c8ee518cc7897aed1';
const ctfAddress = '0x4d97dcd97ec945f40cf65f87097ace5ea0476045';

const abi = [
    'function balanceOf(address account, uint256 id) view returns (uint256)'
];

const provider = new ethers.providers.JsonRpcProvider('https://polygon.llamarpc.com');
const contract = new ethers.Contract(ctfAddress, abi, provider);

async function check() {
    for (let i = 1; i <= 2; i++) {
        // Derive tokenId: keccak256(abi.encodePacked(conditionId, indexSet))
        // Wait, for ConditionalTokens it is a bit different. 
        // TokenId = uint256(keccak256(abi.encodePacked(collateralToken, parentCollectionId, conditionId, indexSet)))
        // Actually, the easy way is to use the derive logic if we know it.
        // But in Polymarket it's simpler: it's just based on conditionId and indexSet if no parent.
        
        // Let's see if we can find the token IDs in the logs for any recent market.
    }
}
// Actually, I'll just check if there is an easy way.
