// src/config.ts
import dotenv from 'dotenv';
import { Address } from 'viem';

dotenv.config();

if (!process.env.RPC_URL || !process.env.CONTRACT_ADDRESS || !process.env.EXPLORER_URL) {
    throw new Error('Required environment variables are not set!');
}


// Ensure the address starts with '0x' and is the correct length
function getAddress(address: string): Address {
    if (!address.startsWith('0x')) {
        address = '0x' + address;
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
        throw new Error('Invalid Ethereum address format');
    }
    return address as Address;
}

export const config = {
    rpcUrl: process.env.RPC_URL,
    contractAddress: getAddress(process.env.CONTRACT_ADDRESS),
    explorerUrl: process.env.EXPLORER_URL.endsWith('/') 
        ? process.env.EXPLORER_URL 
        : `${process.env.EXPLORER_URL}/`,
    blockCountdownUrl: `${process.env.EXPLORER_URL}block/countdown/`
} as const;



