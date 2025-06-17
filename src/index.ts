import { formatEther } from 'viem'
import { config } from './config';
import { StakingContract, TransferEvent } from './contracts/StakingContract';
import { createClickableLink } from './lib/utils';

async function main() {
    console.log('🔮 Staking Contract Metrics Initializing...');
    
    const stakingContract = new StakingContract();
    
    try {
        const [metrics, deployInfo, rewardMetrics, tokenInfo, emissionBlocks] = await Promise.all([
            stakingContract.calculateRequiredFunding(),
            stakingContract.getDeploymentInfo(),
            stakingContract.getRewardMetrics(),
            stakingContract.getTokenInfo(),
            stakingContract.getEmissionBlocks()
        ]);

        console.log('\n📊 Staking Contract Analysis');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // Token Information
        console.log('\n💠 Token Details');
        console.log(`   Name: ${tokenInfo.name}`);
        console.log(`   Symbol: ${tokenInfo.symbol}`);
        console.log(`   Token Address: ${createClickableLink(
            tokenInfo.address as string,
            `${config.explorerUrl}address/${tokenInfo.address}`
        )}`);
        console.log(`   Staking Contract: ${createClickableLink(
            config.contractAddress,
            `${config.explorerUrl}address/${config.contractAddress}`
        )}`);

        // Contract Status
        console.log('\n🚀 Contract Status');
        console.log(`   Current Block: #${deployInfo.currentBlock}`);
        console.log(`   Block Time: ${deployInfo.currentBlockTime.toLocaleString()}`);
        
        // Reward Distribution
        console.log('\n💰 Reward Distribution');
        console.log(`   Per Second: ${rewardMetrics.formatted.rewardsPerSecond} tokens`);
        console.log(`   └─ Raw Wei: ${rewardMetrics.rewardsPerSecond.toString()} wei`);
        console.log(`   Per Block (~12s): ${rewardMetrics.formatted.rewardsPerBlock} tokens`);
        console.log(`   └─ Raw Wei: ${rewardMetrics.rewardsPerBlock.toString()} wei`);
        console.log(`   Per Day: ${rewardMetrics.formatted.rewardsPerDay} tokens`);
        console.log(`   └─ Raw Wei: ${rewardMetrics.rewardsPerDay.toString()} wei`);
        
        // Emission Timeline
        console.log('\n⏳ Emission Schedule');
        console.log(`   Start: ${new Date(emissionBlocks.startTime * 1000).toLocaleString()} (Unix: ${emissionBlocks.startTime})`);
        console.log(`   Start Unix: ${emissionBlocks.startTime} (${new Date(emissionBlocks.startTime * 1000).toLocaleString()})`);
        console.log(`   Start Block: ${createClickableLink(
            `#${emissionBlocks.startBlock}`,
            `${config.explorerUrl}block/countdown/${emissionBlocks.startBlock}`
        )}`);
        console.log(`   End: ${new Date(emissionBlocks.endTime * 1000).toLocaleString()}`);
        console.log(`   End Unix: ${emissionBlocks.endTime} (${new Date(emissionBlocks.endTime * 1000).toLocaleString()})`);
        console.log(`   End Block: ${createClickableLink(
            `#${emissionBlocks.endBlock}`,
            `${config.explorerUrl}block/countdown/${emissionBlocks.endBlock}`
        )}`);
        
        if (metrics.timeLeft <= 0) {
            const daysPast = Math.abs(Math.floor(metrics.timeLeft / 86400));
            const hoursPast = Math.abs(Math.floor((metrics.timeLeft % 86400) / 3600));
            console.log(`   Status: Emission ended ${daysPast} days and ${hoursPast} hours ago`);
        } else {
            console.log(`   Time Remaining: ${Math.floor(metrics.timeLeft / 86400)} days, ${Math.floor((metrics.timeLeft % 86400) / 3600)} hours`);
        }

        console.log('\n📥 Contract Funding History');
        console.log(`   Total Transfers: ${metrics.transferCount}`);
        console.log(`   Total Transferred: ${formatEther(metrics.totalTransferred)} tokens`);
        console.log(`   └─ Raw Wei: ${metrics.totalTransferred.toString()} wei`);

        // Optional: Show individual transfers
        console.log('\n   Recent Transfers:');
        metrics.transfers.slice(-5).forEach((transfer: TransferEvent) => {
            console.log(`   └─ ${formatEther(transfer.amount)} tokens from ${transfer.from} (Block #${transfer.blockNumber})`);
            });

        // Emission Requirements
        console.log('\n💎 Emission Requirements');
        console.log(`   Duration in Seconds: ${metrics.totalSeconds} seconds`);
        console.log(`   Total Duration: ${Math.floor(metrics.totalSeconds / 86400)} days, ${Math.floor((metrics.totalSeconds % 86400) / 3600)} hours`);
        console.log(`   Total Tokens Needed: ${formatEther(metrics.totalTokensNeeded)} tokens`);
        console.log(`   └─ Raw Wei: ${metrics.totalTokensNeeded.toString()} wei`);

        const calculateContractFundingDuration = () => {
            const totalFunded = metrics.totalTransferred;
            const rewardRatePerSecond = rewardMetrics.rewardsPerSecond;
            const emissionStartTime = emissionBlocks.startTime * 1000; // Convert to milliseconds

            // Precise calculation of supported duration
            const supportedSeconds = Number(totalFunded) / Number(rewardRatePerSecond);
            
            // Calculate the exact depletion date from the emission start
            const depletionDate = new Date(emissionStartTime);
            depletionDate.setSeconds(depletionDate.getSeconds() + Number(supportedSeconds));

            return {
                supportedDays: Math.floor(Number(supportedSeconds) / 86400),
                depletionDate,
                emissionStartDate: new Date(emissionStartTime)
            };
        };

        // In your main function
        const fundingDuration = calculateContractFundingDuration();

        console.log('\n💰 Contract Funding Analysis');
        console.log(`   Funds Support: ${fundingDuration.supportedDays} days`);
        console.log(`   Funds Depletion Date: ${fundingDuration.depletionDate.toLocaleString()}`);

        // In your main function

        if (metrics.totalTokensNeeded > metrics.totalTransferred) {
            console.log('\n⚠️ Additional Funding Required:');
            console.log(`   ${formatEther(metrics.requiredTokens)} tokens needed`);
            console.log(`   └─ Raw Wei: ${metrics.requiredTokens.toString()} wei`);
        } else {
            console.log('\n✅ Contract is sufficiently funded for the emission period');
        }        
    } catch (error) {
        console.error('❌ Error analyzing staking contract:', error);
        process.exit(1);
    }
}

main();
