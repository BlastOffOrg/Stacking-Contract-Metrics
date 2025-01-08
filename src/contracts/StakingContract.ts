import { createPublicClient, http, formatEther, getContract, type PublicClient } from 'viem'
import { mainnet } from 'viem/chains'
import { config } from '../config'
import { stakingAbi, erc20Abi, transferEventAbi } from './abis';

export interface TransferEvent {
    from: string;
    amount: bigint;
    blockNumber: bigint;
}

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

        // Per second (base rate)
        const rewardsPerSecond = rewardRate;
        // Per block (12 sec blocks)
        const rewardsPerBlock = rewardRate * 12n;
        // Per day 
        const rewardsPerDay = rewardRate * 86400n;

        return {
            rewardsPerSecond,
            rewardsPerBlock,
            rewardsPerDay,
            formatted: {
                rewardsPerSecond: formatEther(rewardsPerSecond),
                rewardsPerBlock: formatEther(rewardsPerBlock),
                rewardsPerDay: formatEther(rewardsPerDay)
            },
            decimals
        };
    }

async getTokenTransferHistory() {
    const tokenAddress = await this.client.readContract({
        address: config.contractAddress,
        abi: stakingAbi,
        functionName: 'basicToken'
    });

    const currentBlock = await this.client.getBlockNumber();
    const startBlock = BigInt(config.deployBlock);

    // Configuration constants
    const INITIAL_BATCH_SIZE = 200000n;
    const MIN_BATCH_SIZE = 100n;
    const BATCH_DELAY_MS = 1000;
    
    // Mutable batch size that can be adjusted
    let currentBatchSize = INITIAL_BATCH_SIZE;

    const allTransfers: any[] = [];
    const allStakeEvents: any[] = [];

    // Process in smaller chunks
    let fromBlock = startBlock;
    while (fromBlock < currentBlock) {
        const toBlock = (fromBlock + currentBatchSize) > currentBlock 
            ? currentBlock 
            : fromBlock + currentBatchSize;
        
        console.log(`Processing blocks ${fromBlock} to ${toBlock}... (Batch size: ${currentBatchSize})`);

        try {
            const [batchTransfers, batchStakeEvents] = await Promise.all([
                this.client.getLogs({
                    address: tokenAddress,
                    event: transferEventAbi[0],
                    args: { to: config.contractAddress },
                    fromBlock,
                    toBlock
                }),
                this.client.getLogs({
                    address: config.contractAddress,
                    event: {
                        name: 'Staked',
                        type: 'event',
                        inputs: [
                            { name: 'user', type: 'address', indexed: true },
                            { name: 'amount', type: 'uint256' }
                        ]
                    },
                    fromBlock,
                    toBlock
                })
            ]);

            // Successfully processed this batch
            allTransfers.push(...batchTransfers);
            allStakeEvents.push(...batchStakeEvents);

            // Move to next block range
            fromBlock = toBlock + 1n;

            // Add delay between batches to prevent rate limiting
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));

        } catch (error) {
            console.warn(`Error processing batch ${fromBlock}-${toBlock}, reducing batch size and retrying...`);
            
            // Reduce batch size for retry
            currentBatchSize = currentBatchSize / 2n;
            
            if (currentBatchSize < MIN_BATCH_SIZE) {
                throw new Error(`Batch size became too small (${currentBatchSize} blocks). Possible RPC issue or rate limiting.`);
            }
            
            // Don't advance fromBlock - we'll retry this range with smaller batch size
            continue;
        }
    }

    // Create set of staking transaction hashes
    const stakingTxHashes = new Set(
        allStakeEvents.map(log => log.transactionHash)
    );

    // Filter out transfers that were part of staking transactions
    const directTransfers = allTransfers.filter(log =>
        !stakingTxHashes.has(log.transactionHash)
    );

    // Calculate total transferred amount
    const totalTransferred = directTransfers.reduce(
        (sum, log) => sum + (log.args.value ?? 0n),
        0n
    );

    return {
        totalTransferred,
        transferCount: directTransfers.length,
        transfers: directTransfers.map(log => ({
            from: log.args.from ?? '',
            amount: log.args.value ?? 0n,
            blockNumber: log.blockNumber
        } as TransferEvent))
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

        const transferHistory = await this.getTokenTransferHistory();

        // Calculate total time in seconds
        const totalSeconds = BigInt(Number(emissionEnd) - Number(emissionStart));
        
        // Calculate total tokens needed for entire emission period
        const totalTokensNeeded = rewardRate * totalSeconds;
        
        // Calculate how many more tokens we need based on actual transfers
        const requiredTokens = totalTokensNeeded > transferHistory.totalTransferred ? 
            totalTokensNeeded - transferHistory.totalTransferred : 0n;

        const currentTime = BigInt(Math.floor(Date.now() / 1000));
        const timeLeft = Number(emissionEnd - currentTime);
        
        return {
            requiredTokens,
            timeLeft,
            totalSeconds: Number(totalSeconds),
            totalTokensNeeded,
            totalTransferred: transferHistory.totalTransferred,
            transferCount: transferHistory.transferCount,
            transfers: transferHistory.transfers,
            currentBalance: contractBalance - totalStaked - feesAccrued, // Still keeping this for reference
            emissionStart: Number(emissionStart),
            emissionEnd: Number(emissionEnd),
            rewardRate,
            decimals
        };
    }

}
