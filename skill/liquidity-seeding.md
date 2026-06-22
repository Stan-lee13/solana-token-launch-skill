# Liquidity Seeding

Seed initial liquidity correctly. This is the highest-stakes, most irreversible step of a TGE. Wrong choices here cause permanent reputational damage and financial loss.

## DEX Selection Matrix

| Protocol | Best for | Fee model | Notes (2026) |
|---|---|---|---|
| **Meteora DLMM** | New token launches, volatile assets | Dynamic, bin-based | Best price discovery for new tokens; standard for Solana TGEs |
| **Meteora Dynamic AMM** | Stable pairs, lower volatility | Standard AMM | Good for SOL/USDC pairs post-stabilization |
| **Meteora Alpha Vault** | Fair launch / LBP | Auction-based | Use when you want anti-bot fair distribution |
| **Orca Whirlpools** | Established tokens, tight spreads | CLMM, concentrated | Better for established tokens with known price ranges |
| **Raydium CLMM** | High volume, established tokens | CLMM | Large existing LP base; good for high-volume pairs |
| **Raydium AMM v4** | Legacy compatibility | Standard AMM | Only if you need legacy Jupiter routing coverage |

**2026 Recommendation for new TGE:** Start with **Meteora DLMM** for initial price discovery, then add **Orca Whirlpool** or **Raydium CLMM** range orders once price stabilizes.

## Meteora DLMM — Primary Launch Pool

### Why DLMM for TGE
- Bin-based pricing = capital efficient even for volatile new tokens
- Dynamic fees = higher fees during volatility (protects LPs)
- No impermanent loss if you seed only base token (one-sided seeding for fair launch)
- Standard on Solana for 2025-2026 token launches

### Pool initialization

```typescript
import DLMM from "@meteora-ag/dlmm";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import BN from "bn.js";

const connection = new Connection("https://mainnet.helius-rpc.com/?api-key=YOUR_KEY");

// Find or create DLMM pool
const dlmmPool = await DLMM.create(connection, poolAddress);

// Get active bin (current price)
const activeBin = await dlmmPool.getActiveBin();
const currentPrice = dlmmPool.fromPricePerLamport(Number(activeBin.price));

// Get bin arrays for liquidity range
const BINS_AROUND_ACTIVE = 68; // ~1% price range either side
const binArrays = await dlmmPool.getBinArrayForSwap(true);
```

### Seeding strategy for new token launch

```typescript
// One-sided seeding: deposit ONLY your token, let market bring SOL/USDC
// This is the fair launch standard — prevents insider front-running

const totalXAmount = new BN(lpAllocation); // your token amount
const totalYAmount = new BN(0);            // zero SOL/USDC at launch

// Distribution: uniform across bins (simplest, most predictable)
const newPosition = new Keypair();

const { tx: initPositionTx } = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
  positionPubKey: newPosition.publicKey,
  user: payer.publicKey,
  totalXAmount,
  totalYAmount,
  strategy: {
    maxBinId: activeBinId + BINS_AROUND_ACTIVE,
    minBinId: activeBinId - BINS_AROUND_ACTIVE,
    strategyType: StrategyType.SpotImBalanced, // one-sided
  },
});
```

### Fee tier selection

| Bin step | Price range per bin | Best for |
|---|---|---|
| 1 | 0.01% | Stablecoins |
| 10 | 0.1% | Low volatility |
| 25 | 0.25% | Standard launch |
| 100 | 1% | High volatility / meme |
| 200 | 2% | Extreme volatility |

**Recommendation for new token:** Start with bin step 25–100. Tighten after 30 days of price discovery.

## Meteora Alpha Vault — Fair Launch (Anti-Bot)

Use when you want to prevent bots from sniping the launch:

```typescript
import AlphaVault from "@meteora-ag/alpha-vault";

// Alpha Vault enforces:
// - Pro-rata allocation (no first-come-first-served sniping)
// - Deposit cap per wallet
// - Crank-based fair distribution after deposit period closes
```

**Use Alpha Vault when:**
- You have strong community demand and expect bots
- You want a genuine fair launch (equal opportunity for all)
- You're OK with a 1-24hr deposit window before trading begins

## Orca Whirlpool — Post-Stabilization CLMM

Once price has discovered in DLMM (typically 48-72hrs post-launch), add concentrated liquidity on Orca:

```typescript
import { WhirlpoolContext, buildWhirlpoolClient, ORCA_WHIRLPOOL_PROGRAM_ID } from "@orca-so/whirlpools-sdk";
import { Wallet } from "@coral-xyz/anchor";
import Decimal from "decimal.js";

const ctx = WhirlpoolContext.from(
  connection,
  new Wallet(payer),
  ORCA_WHIRLPOOL_PROGRAM_ID
);
const client = buildWhirlpoolClient(ctx);

// Open a position ±20% around current price
const whirlpool = await client.getPool(poolAddress);
const currentTick = whirlpool.getData().tickCurrentIndex;
const tickSpacing = whirlpool.getData().tickSpacing;

const lowerTick = Math.floor((currentTick * 0.8) / tickSpacing) * tickSpacing;
const upperTick = Math.ceil((currentTick * 1.2) / tickSpacing) * tickSpacing;
```

## Liquidity amount guidelines

| Launch size | Minimum initial liquidity | Recommended |
|---|---|---|
| Micro (<$1M FDV) | $10K | $25K+ |
| Small ($1M–$10M FDV) | $50K | $100K–$250K |
| Mid ($10M–$100M FDV) | $250K | $500K–$1M |
| Large ($100M+ FDV) | $1M | $2M–$5M |

**Below minimum = high manipulation risk. Flag this hard.**

## Atomic launch transaction (Jito bundle)

The safest launch pattern: seed liquidity AND open trading in a single atomic Jito bundle, preventing any front-running between pool creation and your LP deposit.

```typescript
import { Bundle } from "jito-ts/dist/sdk/block-engine/types.js";
import { searcherClient } from "jito-ts/dist/sdk/block-engine/searcher.js";

// Build bundle:
// TX 1: Create pool
// TX 2: Seed initial liquidity  
// TX 3: (Optional) Airdrop claim program initialization

const bundle = new Bundle(
  [createPoolTx, seedLiquidityTx],
  5 // max 5 transactions per bundle
);

// Tip account for Jito (required)
const jitoTipAmount = 100_000; // 0.0001 SOL minimum
```

## LP token management

- **Lock LP tokens** for at least 6 months using Streamflow or Meteora's built-in lock
- **Public LP lock** = trust signal. Tweet the lock proof immediately after launch
- **Never hold LP tokens in a hot wallet** — use Squads multisig

```typescript
// Meteora LP lock (built-in)
const lockLpParams = {
  lockDuration: 15552000, // 180 days in seconds
};
```

## Post-seed checklist

- [ ] Pool created and verified on Meteora/Orca/Raydium explorer
- [ ] LP tokens locked and lock proof published
- [ ] Jupiter routing confirmed (token swappable via Jupiter)
- [ ] Price visible on Birdeye and DexScreener within 10 min
- [ ] Liquidity depth sufficient to handle 2% price impact on expected trade sizes
- [ ] Emergency multisig prepared for liquidity removal if critical bug found
