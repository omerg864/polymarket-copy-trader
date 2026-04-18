import 'dotenv/config';
import { Wallet } from '@ethersproject/wallet';
import { RelayClient } from '@polymarket/builder-relayer-client';
import { getCreate2Address, keccak256, encodeAbiParameters, encodePacked } from 'viem';
import config from './src/config';

async function main() {
    const signerAddress = '0x7dD81f8D4fe9a4aFdF6FF4D87E794a051F1CCbb1';
    const funderAddress = config.funderAddress;
    
    // safe derivation
    const safeFactory = '0xaacFeEa03eb1561C4e67d661e40682Bd20E3541b';
    const safeHash = '0x2bce2127ff07fb632d16c8347c4ebf501f4841168bed00d9e6ef715ddb6fcecf';
    const derivedSafe = getCreate2Address({
        from: safeFactory as `0x${string}`,
        bytecodeHash: safeHash as `0x${string}`,
        salt: keccak256(encodeAbiParameters([{ name: 'address', type: 'address' }], [signerAddress as `0x${string}`]))
    });

    // proxy derivation
    const proxyFactory = '0xaB45c5A4B0c941a2F231C04C3f49182e1A254052';
    const proxyHash = '0xd21df8dc65880a8606f09fe0ce3df9b8869287ab0b058be05aa9e8af6330a00b';
    const derivedProxy = getCreate2Address({
        from: proxyFactory as `0x${string}`,
        bytecodeHash: proxyHash as `0x${string}`,
        salt: keccak256(encodePacked(['address'], [signerAddress as `0x${string}`]))
    });

    console.log('--- Address Comparison ---');
    console.log('Signer (EOA):    ', signerAddress);
    console.log('Funder (Actual): ', funderAddress);
    console.log('Derived Safe:    ', derivedSafe);
    console.log('Derived Proxy:   ', derivedProxy);
    
    if (funderAddress.toLowerCase() === derivedSafe.toLowerCase()) {
        console.log('✅ Matches SAFE!');
    } else if (funderAddress.toLowerCase() === derivedProxy.toLowerCase()) {
        console.log('✅ Matches PROXY!');
    } else {
        console.log('❌ MISMATCH with both!');
    }
}

main().catch(console.error);
