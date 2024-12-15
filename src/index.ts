// src/index.ts
import { formatEther } from 'viem'
import { config } from './config';
import { StakingContract } from './contracts/StakingContract';
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
        
        // Contract & Token Information
        console.log('\n💠 Token Details');
        console.log(`   Name: ${tokenInfo.name}`);
        console.log(`   Symbol: ${tokenInfo.symbol}`);
        console.log(`   Token Address: ${createClickableLink(
            tokenInfo.address,
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
        console.log(`   Start: ${new Date(emissionBlocks.startTime * 1000).toLocaleString()}`);
        console.log(`   Start Block: ${createClickableLink(
        `#${emissionBlocks.startBlock}`,
        `${config.explorerUrl}block/countdown/${emissionBlocks.startBlock}`
    )}`);
        console.log(` `);
        console.log(`   End: ${new Date(emissionBlocks.endTime * 1000).toLocaleString()}`);
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
        
        // Balance Information
        console.log('\n💎 Current Status');
        console.log(`   Free Balance: ${formatEther(metrics.currentBalance)} tokens`);
        
        if (metrics.requiredTokens > 0n) {
            console.log(`\n⚠️ Additional Funding Required:`);
            console.log(`   ${formatEther(metrics.requiredTokens)} tokens needed to complete emission schedule`);
        } else {
            console.log('\n✅ Contract is sufficiently funded for the remaining period');
        }
            console.log('\n *Date times are in approximate value, block times are absolute');
    } catch (error) {
        console.error('❌ Error analyzing staking contract:', error);
        process.exit(1);
    }
}

main();
