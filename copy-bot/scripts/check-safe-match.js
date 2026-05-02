const { getCreate2Address, keccak256, encodeAbiParameters, encodePacked } = require('viem');

const signerAddress = '0x7dD81f8D4fe9a4aFdF6FF4D87E794a051F1CCbb1';
const funderAddress = '0xb5637b6692c708b2fe4df77479a893cab62447d2';

// safe derivation
const safeFactory = '0xaacFeEa03eb1561C4e67d661e40682Bd20E3541b';
const safeHash = '0x2bce2127ff07fb632d16c8347c4ebf501f4841168bed00d9e6ef715ddb6fcecf';
const derivedSafe = getCreate2Address({
    from: safeFactory,
    bytecodeHash: safeHash,
    salt: keccak256(encodeAbiParameters([{ name: 'address', type: 'address' }], [signerAddress]))
});

// proxy derivation
const proxyFactory = '0xaB45c5A4B0c941a2F231C04C3f49182e1A254052';
const proxyHash = '0xd21df8dc65880a8606f09fe0ce3df9b8869287ab0b058be05aa9e8af6330a00b';
const derivedProxy = getCreate2Address({
    from: proxyFactory,
    bytecodeHash: proxyHash,
    salt: keccak256(encodePacked(['address'], [signerAddress]))
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
