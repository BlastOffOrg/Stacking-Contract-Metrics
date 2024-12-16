async getTokenTransferHistory() {
    const tokenAddress = await this.client.readContract({
        address: config.contractAddress,
        abi: stakingAbi,
        functionName: 'basicToken'
    });

    const currentBlock = await this.client.getBlockNumber();
    const startBlock = BigInt(config.deployBlock);

    // Configuration for controlled log processing
    const MAX_LOGS_PER_QUERY = 10000; // Most RPC providers' soft limit
    const BATCH_DELAY_MS = 2000; // 2-second delay between batches

    const allTransfers: any[] = [];
    const allStakeEvents: any[] = [];

    let fromBlock = startBlock;
    while (fromBlock < currentBlock) {
        const [batchTransfers, batchStakeEvents] = await Promise.all([
            this.client.getLogs({
                address: tokenAddress,
                event: transferEventAbi[0],
                args: { to: config.contractAddress },
                fromBlock,
                toBlock: currentBlock,
                // Limit log results
                strict: true
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
                toBlock: currentBlock,
                strict: true
            })
        ]);

        // If we hit the max log limit, adjust our block range
        if (
            batchTransfers.length >= MAX_LOGS_PER_QUERY || 
            batchStakeEvents.length >= MAX_LOGS_PER_QUERY
        ) {
            // Narrow the block range if too many logs
            fromBlock = BigInt(
                Math.min(
                    Number(batchTransfers[batchTransfers.length - 1].blockNumber || currentBlock),
                    Number(batchStakeEvents[batchStakeEvents.length - 1].blockNumber || currentBlock)
                )
            ) + 1n;
        } else {
            // If we didn't hit the limit, we've processed all logs
            allTransfers.push(...batchTransfers);
            allStakeEvents.push(...batchStakeEvents);
            break;
        }

        // Add logs to our collection
        allTransfers.push(...batchTransfers);
        allStakeEvents.push(...batchStakeEvents);

        // Controlled delay to prevent overwhelming the network
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));

        console.log(`Processed logs up to block ${fromBlock}`);
    }

    // Rest of your existing processing logic remains the same
    const stakingTxHashes = new Set(
        allStakeEvents.map(log => log.transactionHash)
    );

    const directTransfers = allTransfers.filter(log => 
        !stakingTxHashes.has(log.transactionHash)
    );

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
