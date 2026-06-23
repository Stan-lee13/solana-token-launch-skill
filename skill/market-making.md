# Market Making for Solana Token Launches

Healthy markets don't happen by accident. This skill covers self-market-making on Meteora DLMM, hiring professional MMs, and monitoring spread/depth in real time.

## Why this matters at launch

Without active market making:
- Bid-ask spread blows out to 5–20%
- Users get ruinous price impact on any meaningful trade
- Birdeye/DexScreener shows low volume → filtered out of discovery
- Whales can easily manipulate price with small capital

## Option 1: Self-market-making with Meteora DLMM (bootstrap phase)

Meteora Dynamic Liquidity Market Maker lets you concentrate liquidity around the current price and earn fees while providing depth.

### Initial pool creation

```typescript
import DLMM from "@meteora-ag/dlmm";
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

const connection = new Connection("https://mainnet.helius-rpc.com/?api-key=YOUR_KEY");

async function createLaunchPool(
  tokenMint: PublicKey,
  quoteMint: PublicKey,  // USDC or SOL
  initialPriceUSD: number,
  liquidityUSD: number,
  ownerKeypair: Keypair
) {
  // Bin step of 10 = 0.1% price increments (tight spread)
  // Use 25 for more volatile tokens, 5 for stable pairs
  const BIN_STEP = 10;

  const createPoolTx = await DLMM.createLbPair(
    connection,
    ownerKeypair.publicKey,
    tokenMint,
    quoteMint,
    new BN(BIN_STEP),
    {
      activeId: priceToActiveBin(initialPriceUSD, BIN_STEP),
      feeBps: 25,       // 0.25% fee — standard for volatile tokens
    }
  );

  const sig = await sendAndConfirmTransaction(
    connection,
    createPoolTx,
    [ownerKeypair]
  );

  console.log("Pool created:", sig);
  return sig;
}

function priceToActiveBin(price: number, binStep: number): number {
  // Active bin = ln(price) / ln(1 + binStep/10000)
  return Math.floor(Math.log(price) / Math.log(1 + binStep / 10_000));
}
```

### Adding concentrated liquidity around launch price

```typescript
async function seedInitialLiquidity(
  poolAddress: PublicKey,
  ownerKeypair: Keypair,
  tokenAmountRaw: bigint,
  quoteAmountRaw: bigint,
  rangePercent: number = 20  // ±20% around current price
) {
  const dlmmPool = await DLMM.create(connection, poolAddress);
  const activeBin = await dlmmPool.getActiveBin();

  // Calculate bin range for ±rangePercent
  const binsPerSide = Math.floor(rangePercent / (dlmmPool.lbPair.binStep / 100));
  const minBinId = activeBin.binId - binsPerSide;
  const maxBinId = activeBin.binId + binsPerSide;

  // Spot distribution = equal liquidity across all bins
  const addLiquidityTx = await dlmmPool.addLiquidityByStrategy({
    positionPubKey: Keypair.generate().publicKey,
    user: ownerKeypair.publicKey,
    totalXAmount: new BN(tokenAmountRaw.toString()),
    totalYAmount: new BN(quoteAmountRaw.toString()),
    strategy: {
      maxBinId,
      minBinId,
      strategyType: StrategyType.SpotImBalanced, // More of your token on the sell side
    },
  });

  return sendAndConfirmTransaction(connection, addLiquidityTx, [ownerKeypair]);
}
```

### Automated rebalancing (run as a cron job)

```typescript
async function rebalanceIfNeeded(
  poolAddress: PublicKey,
  positionAddress: PublicKey,
  ownerKeypair: Keypair,
  targetRangePercent: number = 20
) {
  const dlmmPool = await DLMM.create(connection, poolAddress);
  const activeBin = await dlmmPool.getActiveBin();
  const position = await dlmmPool.getPosition(positionAddress);

  const { lowerBinId, upperBinId } = position.positionData;
  const midBin = Math.floor((lowerBinId + upperBinId) / 2);

  // Rebalance if price has drifted more than 10% from position center
  const driftBins = Math.abs(activeBin.binId - midBin);
  const totalBins = upperBinId - lowerBinId;

  if (driftBins > totalBins * 0.1) {
    console.log(`Rebalancing — price drifted ${driftBins} bins from center`);

    // Remove existing liquidity
    const removeTx = await dlmmPool.removeLiquidity({
      user: ownerKeypair.publicKey,
      position: positionAddress,
      fromBinId: lowerBinId,
      toBinId: upperBinId,
      bps: new BN(10000), // 100%
      shouldClaimAndClose: false,
    });
    await sendAndConfirmTransaction(connection, removeTx, [ownerKeypair]);

    // Re-add centered on new price
    await seedInitialLiquidity(poolAddress, ownerKeypair, /* current balances */);
  }
}
```

## Option 2: Hiring a professional market maker

### Term sheet checklist (non-negotiable items)

```
MARKET MAKER AGREEMENT — MUST-HAVES

Token Loan Terms:
[ ] Total tokens loaned to MM (e.g., 2% of supply)
[ ] Loan duration (e.g., 12 months with 30-day notice)
[ ] Return conditions: exact return or cash equivalent at expiry?
[ ] Who bears inventory risk if price drops 80%?

Performance Obligations:
[ ] Maximum spread: e.g., "bid-ask spread ≤ 0.5% during hours X-Y"
[ ] Minimum depth: e.g., "$50,000 within ±2% of mid at all times"
[ ] Uptime: e.g., "95% of trading hours"
[ ] Coverage: which exchanges (DEX + CEX list)

Reporting:
[ ] Daily/weekly dashboard access
[ ] Monthly performance report
[ ] Incident reporting if obligations are breached

Exit Terms:
[ ] 30-day notice to terminate
[ ] Token return mechanism (on-chain escrow preferred)
[ ] What happens if MM goes insolvent?
```

### Market maker contacts (2026)

| MM | Tier | Best for | Contact |
|---|---|---|---|
| Wintermute | 1 | Large launches ($100M+ FDV) | bd@wintermute.com |
| Flowdesk | 2 | Mid-tier ($20-100M FDV) | contact@flowdesk.co |
| Kairon Labs | 2 | Solana-native, smaller budget | kaironlabs.com |
| GSR | 1-2 | DeFi-native, deep Solana | gsr.io |
| Atrix | Budget | Self-service, Solana only | atrix.finance |

## Real-time spread and depth monitoring

```typescript
// monitor/liquidityHealth.ts
import { Connection, PublicKey } from "@solana/web3.js";
import DLMM from "@meteora-ag/dlmm";

interface LiquidityHealth {
  spread: number;        // bid-ask spread as %
  depthPlus2: number;   // USD depth within +2% of mid
  depthMinus2: number;  // USD depth within -2% of mid
  activeBinPrice: number;
  totalTVL: number;
  healthy: boolean;
}

async function checkLiquidityHealth(
  poolAddress: string,
  tokenPriceUSD: number
): Promise<LiquidityHealth> {
  const dlmmPool = await DLMM.create(connection, new PublicKey(poolAddress));
  const activeBin = await dlmmPool.getActiveBin();
  const binArrays = await dlmmPool.getBinArrays();

  let depthPlus2 = 0;
  let depthMinus2 = 0;
  let totalTVL = 0;

  // Calculate depth by walking bins ±2% from active
  const binStep = dlmmPool.lbPair.binStep;
  const binsFor2Pct = Math.ceil(200 / (binStep / 100));

  for (const binArray of binArrays) {
    for (const bin of binArray.account.bins) {
      const binId = bin.binId;
      const binPrice = activeBin.price * Math.pow(1 + binStep / 10000, binId - activeBin.binId);
      const binValueUSD = /* calculate from bin.amountX + bin.amountY */ 0;

      totalTVL += binValueUSD;

      if (binId >= activeBin.binId && binId <= activeBin.binId + binsFor2Pct) {
        depthPlus2 += binValueUSD;
      }
      if (binId <= activeBin.binId && binId >= activeBin.binId - binsFor2Pct) {
        depthMinus2 += binValueUSD;
      }
    }
  }

  const spread = binStep / 100; // DLMM spread ≈ bin step %

  return {
    spread,
    depthPlus2,
    depthMinus2,
    activeBinPrice: activeBin.price,
    totalTVL,
    healthy: spread < 1 && depthPlus2 > 20_000 && depthMinus2 > 20_000,
  };
}

// Alert if liquidity health degrades
async function monitorAndAlert(poolAddress: string, tokenPrice: number) {
  const health = await checkLiquidityHealth(poolAddress, tokenPrice);

  if (!health.healthy) {
    const reasons = [];
    if (health.spread > 1) reasons.push(`Spread at ${health.spread.toFixed(2)}% (target: <1%)`);
    if (health.depthPlus2 < 20_000) reasons.push(`Ask depth only $${health.depthPlus2.toFixed(0)} (target: >$20K)`);
    if (health.depthMinus2 < 20_000) reasons.push(`Bid depth only $${health.depthMinus2.toFixed(0)} (target: >$20K)`);

    await sendTelegramAlert(`⚠️ Liquidity health degraded:\n${reasons.join("\n")}`);
  }

  return health;
}
```

## Launch day liquidity checklist

```
PRE-LAUNCH (T-24h):
[ ] Pool created on Meteora DLMM (bin step set, fee tier confirmed)
[ ] Initial liquidity seeded (at least $50K both sides)
[ ] Jupiter auto-discovered the pool (verify at jup.ag)
[ ] Birdeye showing correct price and logo
[ ] DexScreener listing confirmed
[ ] Monitoring webhook active
[ ] MM agreement signed and API keys tested (if pro MM)

LAUNCH (T-0):
[ ] Price visible at correct launch price
[ ] Spread <1% confirmed
[ ] No abnormal sell pressure in first 5 minutes
[ ] Sniper bot activity checked (large buys in first block)

POST-LAUNCH (first 24h):
[ ] Rebalance position if price moves >15%
[ ] Check depth every 6 hours
[ ] Volume/TVL ratio healthy (>50% = active market)
[ ] Holder count growing (not just whale accumulation)
```
