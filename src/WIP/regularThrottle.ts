 async getTokenTransferHistory() {
>>133     const tokenAddress = await this.client.readContract({
  134         address: config.contractAddress,
  135         abi: stakingAbi,
  136         functionName: ' (alias) const stakingAbi: readonly [{
  137     });                     readonly inputs: readonly [];
  138                             readonly name: "rewardRate";
>>139     const currentBlock      readonly outputs: readonly [{
  140     const startBlock =          readonly type: "uint256";
  141                             }];
  142     // Configuration fo     readonly stateMutability: "view";
  143     const BLOCK_BATCH_S     readonly type: "function";
  144     const BATCH_DELAY_M }, {                                  es
  145                             readonly inputs: readonly [];
  146     // Containers for a     readonly name: "emissionEnd";
  147     const allTransfers:     readonly outputs: readonly [...];
  148     const allStakeEvent     readonly stateMutability: "view";
  149                             readonly type: "function";
  150     // Incremental bloc }, ... 4 more ..., {
  151     for (                   ...;
  152         let fromBlock = }]
  153         fromBlock < cur import stakingAbi
  154         fromBlock += BL
  155     ) {
  156         // Calculate the toBlock for this iteration
  157         const toBlock = BigInt(Math.min(
  158             Number(fromBlock + BLOCK_BATCH_SIZE),
  159             Number(currentBlock)
  160         ));
  161
  162         console.log(`Processing blocks ${fromBlock} to ${toBlock}`);
  163
  164         // Perform batched queries with error handling
  165         const [batchTransfers, batchStakeEvents] = await Promise.all([
>>166             this.client.getLogs({
  167                 address: tokenAddress,
  168                 event: transferEventAbi[0],
  169                 args: { to: config.contractAddress },
  170                 fromBlock,
  171                 toBlock
  172             }),
>>173             this.client.getLogs({
  174                 address: config.contractAddress,
  175                 event: {
  176                     name: 'Staked',
  177                     type: 'event',
  178                     inputs: [
  179                         { name: 'user', type: 'address', indexed: true },
  180                         { name: 'amount', type: 'uint256' }
  181                     ]
  182                 },
  183                 fromBlock,
  184                 toBlock
  185             })
  186         ]);
  188         // Aggregate results
  189         allTransfers.push(...batchTransfers);
  190         allStakeEvents.push(...batchStakeEvents);
  191
  192         // Controlled delay to prevent overwhelming the network
  193         await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
  194     }
  195
  196     // Create set of staking transaction hashes
  197     const stakingTxHashes = new Set(
  198         allStakeEvents.map(log => log.transactionHash)
  199     );
  200
  201     // Filter out transfers that were part of staking transactions
  202     const directTransfers = allTransfers.filter(log =>
  203         !stakingTxHashes.has(log.transactionHash)
  204     );
  205
  206     // Calculate total transferred amount
  207     const totalTransferred = directTransfers.reduce(
  208         (sum, log) => sum + (log.args.value ?? 0n),
  209         0n
  210     );
  211
  212     return {
  213         totalTransferred,
  214         transferCount: directTransfers.length,
  215         transfers: directTransfers.map(log => ({
  216             from: log.args.from ?? '',
  217             amount: log.args.value ?? 0n,
  218             blockNumber: log.blockNumber
  219         } as TransferEvent))
  220     };
  221 }
  222
