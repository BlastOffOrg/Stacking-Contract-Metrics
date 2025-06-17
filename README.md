# Staking Contract Metrics

A comprehensive analytics tool for Blast staking contracts, providing detailed metrics about rewards distribution, emission schedules, and contract status.

## Features

- Real-time staking contract analysis
- Precise reward rate calculations (per second/block/day)
- Emission schedule tracking
- Token details and balances
- Interactive terminal links to Etherscan
- Wei-precise calculations for all token amounts

## Prerequisites

- Node.js (>= 16.x)
- pnpm
- A valid Ethereum RPC endpoint

## Installation

```bash
# Clone the repository
git clone [your-repo-url]
cd staking-contract-metrics

# Install dependencies
pnpm install
```

## Configuration

Create a `.env` file in the root directory:

```env
RPC_URL=https://eth.llamarpc.com
CONTRACT_ADDRESS=0xb07B92c182575b3cBa1a8E7b07d573935A242000
EXPLORER_URL=https://etherscan.io/
BLOCK_COUNTDOWN_URL=https://etherscan.io/block/countdown/
```

## Usage

```bash
# Run the analysis
pnpm start
```

## Output Example

```
📊 Staking Contract Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━

💠 Token Details
   Name: MetaZero
   Symbol: MZERO
   Token Address: 0x328a268b191ef593B72498a9e8a481C086EB21be
   Staking Contract: 0xb07B92c182575b3cBa1a8E7b07d573935A242000

💰 Reward Distribution
   Per Second: 0.096450617283950617 tokens
   └─ Raw Wei: 96450617283950617000 wei
   Per Block (~12s): 1.157407407407407 tokens
   └─ Raw Wei: 1157407407407407000000 wei
   Per Day: 8333.333333333332 tokens
   └─ Raw Wei: 8333333333333332000000000 wei

⏳ Emission Schedule
   Start: 4/11/2024, 12:00:00 AM
   Start Block: #19617963
   End: 12/6/2024, 11:00:00 PM
   End Block: #21345962
```

## Project Structure

```
staking-contract-metrics/
├── src/
│   ├── contracts/
│   │   ├── abis.ts          # Contract ABIs
│   │   └── StakingContract.ts
│   ├── lib/
│   │   └── utils.ts         # Utility functions
│   ├── config.ts            # Configuration
│   └── index.ts             # Main entry
├── .env
└── package.json
```

## Technical Details

The tool provides:
- Wei-precise calculations for all token amounts
- Reward rates calculated per second, block (~12s), and day
- Clickable terminal links for block numbers and addresses
- Real-time contract status monitoring
- Accurate emission schedule tracking

## Development

```bash
# Run in development mode with auto-reload
pnpm dev

# Build the project
pnpm build
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see the [LICENSE](LICENSE) file for details
