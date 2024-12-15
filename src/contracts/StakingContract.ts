import { createPublicClient, http, type PublicClient } from 'viem'
import { mainnet } from 'viem/chains'
import { config } from '../config'
import { stakingAbi, erc20Abi } from './abis'

export class StakingContract {
    private client: PublicClient;

    constructor() {
        this.client = createPublicClient({
            chain: mainnet,
            transport: http(config.rpcUrl)
        });
    }

    async getDeploymentInfo() {
        const bytecode = await this.client.getBytecode({
            address: config.contractAddress,
        });

        if (!bytecode) throw new Error('Contract not found');

        const block = await this.client.getBlock();
        
        return {
            currentBlock: block.number,
            currentBlockTime: new Date(Number(block.timestamp) * 1000),
            blockTimestamp: Number(block.timestamp)
        };
    }

    async getEmissionBlocks() {
        const [emissionStart, emissionEnd] = await Promise.all([
            this.client.readContract({
                address: config.contractAddress,
                abi: stakingAbi,
                functionName: 'emissionStart'
            }),
            this.client.readContract({
                address: config.contractAddress,
                abi: stakingAbi,
                functionName: 'emissionEnd'
            })
        ]);

        const latestBlock = await this.client.getBlockNumber();
        
        // Calculate blocks assuming ~12 second block time
        const startBlock = latestBlock - BigInt(Math.floor((Date.now()/1000 - Number(emissionStart)) / 12));
        const endBlock = latestBlock + BigInt(Math.floor((Number(emissionEnd) - Date.now()/1000) / 12));

        return {
            startBlock,
            endBlock,
            startTime: Number(emissionStart),
            endTime: Number(emissionEnd)
        };
    }

    async getTokenInfo() {
        const tokenAddress = await this.client.readContract({
            address: config.contractAddress,
            abi: stakingAbi,
            functionName: 'basicToken'
        });

        const [name, symbol] = await Promise.all([
            this.client.readContract({
                address: tokenAddress,
                abi: erc20Abi,
                functionName: 'name'
            }),
            this.client.readContract({
                address: tokenAddress,
                abi: erc20Abi,
                functionName: 'symbol'
            })
        ]);

        return {
            name,
            symbol,
            address: tokenAddress
        };
    }

    async getRewardMetrics() {
        const [rewardRate, tokenAddress] = await Promise.all([
            this.client.readContract({
                address: config.contractAddress,
                abi: stakingAbi,
                functionName: 'rewardRate'
            }),
            this.client.readContract({
                address: config.contractAddress,
                abi: stakingAbi,
                functionName: 'basicToken'
            })
        ]);

        const decimals = await this.client.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'decimals'
        });

        const rewardsPerBlock = rewardRate * 12n;
        const rewardsPerDay = rewardRate * 86400n;

        const divisor = 10n ** BigInt(decimals);

        return {
            rewardsPerBlock: Number(rewardsPerBlock) / Number(divisor),
            rewardsPerDay: Number(rewardsPerDay) / Number(divisor),
            rewardRateRaw: rewardRate,
            decimals
        };
    }

    async calculateRequiredFunding() {
        const [
            rewardRate,
            emissionEnd,
            emissionStart,
            lastUpdateTime,
            totalStaked,
            feesAccrued,
            tokenAddress,
        ] = await Promise.all([
            this.client.readContract({
                address: config.contractAddress,
                abi: stakingAbi,
                functionName: 'rewardRate'
            }),
            this.client.readContract({
                address: config.contractAddress,
                abi: stakingAbi,
                functionName: 'emissionEnd'
            }),
            this.client.readContract({
                address: config.contractAddress,
                abi: stakingAbi,
                functionName: 'emissionStart'
            }),
            this.client.readContract({
                address: config.contractAddress,
                abi: stakingAbi,
                functionName: 'lastUpdateTime'
            }),
            this.client.readContract({
                address: config.contractAddress,
                abi: stakingAbi,
                functionName: 'totalStaked'
            }),
            this.client.readContract({
                address: config.contractAddress,
                abi: stakingAbi,
                functionName: 'feesAccrued'
            }),
            this.client.readContract({
                address: config.contractAddress,
                abi: stakingAbi,
                functionName: 'basicToken'
            })
        ]);

        const [contractBalance, decimals] = await Promise.all([
            this.client.readContract({
                address: tokenAddress,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [config.contractAddress]
            }),
            this.client.readContract({
                address: tokenAddress,
                abi: erc20Abi,
                functionName: 'decimals'
            })
        ]);

        const freeBalance = contractBalance - totalStaked - feesAccrued;
        const currentTime = BigInt(Math.floor(Date.now() / 1000));
        const timeLeft = Number(emissionEnd - currentTime);
        
        return {
            requiredTokens: 0n,
            timeLeft,
            currentBalance: freeBalance,
            emissionStart: Number(emissionStart),
            emissionEnd: Number(emissionEnd),
            rewardRate,
            decimals
        };
    }
}
