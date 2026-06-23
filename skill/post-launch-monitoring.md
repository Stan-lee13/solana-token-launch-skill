# Post-Launch Monitoring

Real-time monitoring of your token's health post-TGE using Helius, Birdeye, and on-chain data pipelines.

## Critical metrics to track (first 72 hours)

```
PRICE:          Current price, 1h/24h/7d change
VOLUME:         24h volume (healthy = 10-50% of market cap)
HOLDERS:        Total unique holder count, trend
LIQUIDITY:      TVL in pools, liquidity depth at ±2%
CONCENTRATION:  Top 10 holders % (alarm if >50%)
SELL PRESSURE:  Net flow: buys vs sells in real-time
CLIP SIZE:      Average trade size (large = whales; small = retail)
LP HEALTH:      Fees earned, IL, in-range position status
```

## Helius webhook monitoring

### Setup: Real-time transaction alerts

```typescript
import { Helius } from "helius-sdk";

const helius = new Helius("YOUR_API_KEY");

// Monitor all transactions involving your token
await helius.createWebhook({
  webhookURL: "https://your-server.com/webhook",
  transactionTypes: ["SWAP"],
  accountAddresses: [
    tokenMintAddress,
    meteoraPoolAddress,
    orcaPoolAddress,
  ],
  webhookType: "enhanced",
  authHeader: process.env.WEBHOOK_SECRET, // Verify it's from Helius
});
```

### Webhook handler (Next.js API route)

```typescript
// pages/api/helius-webhook.ts
import type { NextApiRequest, NextApiResponse } from "next";

interface HeliusTransaction {
  signature: string;
  type: string;
  tokenTransfers: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    mint: string;
    tokenAmount: number;
  }>;
  nativeTransfers: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers["authorization"] !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const transactions: HeliusTransaction[] = req.body;

  for (const tx of transactions) {
    const relevantTransfers = tx.tokenTransfers.filter(
      (t) => t.mint === TOKEN_MINT
    );

    for (const transfer of relevantTransfers) {
      const amountUSD = transfer.tokenAmount * currentPrice;

      // Alert on whale movements
      if (amountUSD > WHALE_THRESHOLD_USD) {
        await sendAlert({
          type: "WHALE_TRANSFER",
          from: transfer.fromUserAccount,
          to: transfer.toUserAccount,
          amount: transfer.tokenAmount,
          amountUSD,
          signature: tx.signature,
        });
      }
    }
  }

  return res.status(200).json({ received: true });
}
```

## Holder tracking

### Track holder growth and distribution

```typescript
// Helius getTokenAccounts — paginated holder list
async function getAllHolders(mint: string): Promise<Map<string, number>> {
  const holders = new Map<string, number>();
  let cursor: string | null = null;

  do {
    const response = await helius.rpc.getTokenAccounts({
      mint,
      limit: 1000,
      cursor: cursor ?? undefined,
      options: { showZeroBalance: false },
    });

    for (const account of response.token_accounts) {
      holders.set(account.owner, account.amount);
    }

    cursor = response.cursor ?? null;
  } while (cursor);

  return holders;
}

// Concentration analysis
function analyzeConcentration(holders: Map<string, number>) {
  const sortedBalances = Array.from(holders.values()).sort((a, b) => b - a);
  const totalSupply = sortedBalances.reduce((a, b) => a + b, 0);

  return {
    top10Percent: sortedBalances.slice(0, 10).reduce((a, b) => a + b, 0) / totalSupply * 100,
    top100Percent: sortedBalances.slice(0, 100).reduce((a, b) => a + b, 0) / totalSupply * 100,
    holderCount: holders.size,
    giniCoefficient: calculateGini(sortedBalances), // 0=equal, 1=fully concentrated
  };
}
```

## LP health monitoring

### Monitor Meteora DLMM position

```typescript
import DLMM from "@meteora-ag/dlmm";

async function checkPoolHealth(poolAddress: string) {
  const pool = await DLMM.create(connection, new PublicKey(poolAddress));
  const poolState = await pool.getActiveBin();

  const activeBinId = poolState.binId;
  const positions = await pool.getPositionsByUserAndLbPair(userPublicKey);

  for (const position of positions) {
    const { positionData } = position;

    const isInRange =
      activeBinId >= positionData.lowerBinId &&
      activeBinId <= positionData.upperBinId;

    const rangePercent =
      (activeBinId - positionData.lowerBinId) /
      (positionData.upperBinId - positionData.lowerBinId);

    if (!isInRange) {
      await sendAlert({
        type: "LP_OUT_OF_RANGE",
        pool: poolAddress,
        message: "Your DLMM position is out of range. Rebalance needed.",
      });
    } else if (rangePercent < 0.1 || rangePercent > 0.9) {
      await sendAlert({
        type: "LP_APPROACHING_RANGE_EDGE",
        message: `Position ${Math.round(rangePercent * 100)}% through range. Consider rebalancing soon.`,
      });
    }
  }
}
```

## Anomaly detection

### Red flags to auto-alert on

```typescript
const ANOMALY_RULES = {
  // Price manipulation signal
  PRICE_SPIKE_5MIN: { change: 0.20, window: 300 },   // >20% move in 5 min
  PRICE_DROP_5MIN:  { change: -0.15, window: 300 },  // >15% drop in 5 min

  // Whale activity
  WHALE_SWAP_USD:    500_000,  // Single swap >$500K
  WHALE_TRANSFER_USD: 250_000, // Non-swap transfer >$250K

  // Liquidity warning
  LP_TVL_DROP_1HR: -0.30,      // TVL drops >30% in 1 hour (LP withdrawal)

  // Sybil/airdrop farming post-launch
  NEW_WALLET_CLAIM_BURST: 100, // >100 new wallets claiming in 10 min
};
```

## Dashboard recommendations

### Free tools (use immediately)

| Tool | What to monitor |
|---|---|
| **Birdeye** | Price, volume, holder count, liquidity depth |
| **DexScreener** | Real-time trades, buy/sell ratio, holder growth |
| **SolanaFM** | Transaction explorer, account history |
| **Step Finance** | Portfolio + LP position tracker |
| **Nansen** (paid) | Smart money tracking, wallet labels |

### Custom Grafana dashboard (production setup)

```yaml
# Metrics to pipe into Grafana via Helius webhooks:
metrics:
  - token_price_usd
  - volume_24h_usd
  - holder_count
  - lp_tvl_usd
  - top10_concentration_pct
  - buy_sell_ratio_1h
  - whale_transactions_24h
  - new_holders_24h
  - claims_remaining_pct
```

## 30-day post-launch KPI targets

| Metric | Healthy | Warning | Critical |
|---|---|---|---|
| Holder growth | +5%/week | Flat | Declining |
| Volume/Market Cap | 5–30% | <3% or >50% | <1% or >100% |
| Top 10 concentration | <40% | 40–60% | >60% |
| LP TVL vs Market Cap | >5% | 2–5% | <2% |
| Buy/Sell ratio (7d avg) | >1.0 | 0.7–1.0 | <0.7 |

## Unlock event preparation

Before every major vesting unlock:
```
T-14d: Communicate unlock publicly (builds trust, reduces panic)
T-7d:  Publish unlock schedule visualization
T-3d:  Confirm with vesting contract what exactly unlocks
T-1d:  Coordinate with market maker to increase depth
T+0d:  Monitor price closely for 24 hours
T+3d:  Publish post-unlock update: what was sold, what was retained
```

---

## Sell Pressure Detection Algorithm

```typescript
// src/monitors/sell-pressure.ts
// Distinguishes organic profit-taking from coordinated distribution

import { Helius } from "helius-sdk";

interface SellPressureAnalysis {
  netFlowUsd: number;          // Negative = net selling
  buyVsSellRatio: number;      // <1 = more selling than buying
  largeSellerCount: number;    // Wallets selling >$10K in 24h
  isOrganized: boolean;        // Multiple wallets, similar timing = coordinated
  topSellers: Array<{ wallet: string; amountUsd: number; txCount: number }>;
  verdict: "HEALTHY" | "WATCH" | "HEAVY_DISTRIBUTION" | "COORDINATED_EXIT";
}

async function analyzeSellPressure(
  tokenMint: string,
  poolAddresses: string[],
  windowHours: number = 24
): Promise<SellPressureAnalysis> {
  const helius = new Helius(process.env.HELIUS_API_KEY!);

  const txs = await helius.rpc.getTransactionHistory({
    address: tokenMint,
    options: { limit: 500 },
  });

  const now = Date.now() / 1000;
  const windowStart = now - windowHours * 3600;
  const windowTxs = txs.filter((tx) => tx.timestamp > windowStart);

  let totalBuyVolume = 0;
  let totalSellVolume = 0;
  const sellerMap = new Map<string, { amountUsd: number; txCount: number; timestamps: number[] }>();

  for (const tx of windowTxs) {
    for (const transfer of tx.tokenTransfers ?? []) {
      if (transfer.mint !== tokenMint) continue;
      const usdValue = Number(transfer.tokenAmount) * (await getTokenPriceUsd(tokenMint));

      // Heuristic: transfer FROM pool = buy, transfer TO pool = sell
      const isToPool = poolAddresses.includes(transfer.toUserAccount);
      const isFromPool = poolAddresses.includes(transfer.fromUserAccount);

      if (isFromPool && !isToPool) {
        totalBuyVolume += usdValue;
      } else if (isToPool && !isFromPool) {
        totalSellVolume += usdValue;
        const seller = transfer.fromUserAccount;
        const existing = sellerMap.get(seller) ?? { amountUsd: 0, txCount: 0, timestamps: [] };
        sellerMap.set(seller, {
          amountUsd: existing.amountUsd + usdValue,
          txCount: existing.txCount + 1,
          timestamps: [...existing.timestamps, tx.timestamp],
        });
      }
    }
  }

  const buyVsSellRatio = totalBuyVolume / Math.max(totalSellVolume, 1);
  const topSellers = [...sellerMap.entries()]
    .sort(([, a], [, b]) => b.amountUsd - a.amountUsd)
    .slice(0, 10)
    .map(([wallet, data]) => ({ wallet, ...data }));

  const largeSellerCount = topSellers.filter((s) => s.amountUsd > 10_000).length;

  // Coordinated exit: multiple wallets selling large amounts within the same 30-minute window
  const COORDINATION_WINDOW = 1800; // 30 minutes
  let isOrganized = false;
  const largeSellers = topSellers.filter((s) => s.amountUsd > 5_000);
  if (largeSellers.length >= 3) {
    const allTimestamps = largeSellers.flatMap((s) => s.timestamps);
    for (let i = 0; i < allTimestamps.length; i++) {
      const clustered = allTimestamps.filter(
        (t) => Math.abs(t - allTimestamps[i]) < COORDINATION_WINDOW
      );
      if (clustered.length >= 3) {
        isOrganized = true;
        break;
      }
    }
  }

  const verdict =
    isOrganized ? "COORDINATED_EXIT" :
    buyVsSellRatio < 0.5 && largeSellerCount > 5 ? "HEAVY_DISTRIBUTION" :
    buyVsSellRatio < 0.7 ? "WATCH" :
    "HEALTHY";

  return {
    netFlowUsd: totalBuyVolume - totalSellVolume,
    buyVsSellRatio,
    largeSellerCount,
    isOrganized,
    topSellers,
    verdict,
  };
}
```

---

## LP Health Real-Time Monitor

```typescript
// src/monitors/lp-health.ts
// Monitors Meteora DLMM position — warns when out-of-range or thin

import DLMM from "@meteora-ag/dlmm";
import { Connection, PublicKey } from "@solana/web3.js";

interface LPHealthReport {
  poolAddress: string;
  activeBinPrice: number;
  liquidityInRange: bigint;
  liquidityTotal: bigint;
  inRangePct: number;       // What % of liquidity is earning fees right now
  spreadBps: number;        // Current bid-ask spread in basis points
  dailyFeesEarned: number;  // USD
  isOutOfRange: boolean;
  alert: string | null;
}

async function monitorLPHealth(poolAddress: string): Promise<LPHealthReport> {
  const connection = new Connection(process.env.HELIUS_RPC_URL!);
  const dlmmPool = await DLMM.create(connection, new PublicKey(poolAddress));

  const activeBin = await dlmmPool.getActiveBin();
  const activeBinPrice = dlmmPool.fromPricePerLamport(Number(activeBin.price));

  // Get all liquidity positions
  const { userPositions } = await dlmmPool.getPositionsByUserAndLbPair(
    new PublicKey(process.env.LP_OWNER_ADDRESS!)
  );

  let liquidityInRange = 0n;
  let liquidityTotal = 0n;

  for (const position of userPositions) {
    for (const binData of position.positionData.positionBinData) {
      const binLiquidity = BigInt(binData.positionLiquidityShare);
      liquidityTotal += binLiquidity;
      if (binData.binId === activeBin.binId ||
          Math.abs(binData.binId - activeBin.binId) <= 5) { // within 5 bins
        liquidityInRange += binLiquidity;
      }
    }
  }

  const inRangePct = liquidityTotal > 0n
    ? Number(liquidityInRange * 10000n / liquidityTotal) / 100
    : 0;

  // Estimate spread from bin step
  const binStep = dlmmPool.lbPair.binStep;
  const spreadBps = binStep; // In DLMM, bin step approximates spread

  const isOutOfRange = inRangePct < 10; // Less than 10% in range = position ineffective

  let alert: string | null = null;
  if (isOutOfRange) {
    alert = `⚠️ LP position is OUT OF RANGE — only ${inRangePct.toFixed(1)}% earning fees. Rebalance now.`;
  } else if (inRangePct < 30) {
    alert = `LP position drifting — ${inRangePct.toFixed(1)}% in range. Consider rebalancing within 24h.`;
  } else if (spreadBps > 100) {
    alert = `Spread at ${spreadBps}bps — wide for an established token. Consider tightening range.`;
  }

  return {
    poolAddress,
    activeBinPrice,
    liquidityInRange,
    liquidityTotal,
    inRangePct,
    spreadBps,
    dailyFeesEarned: 0, // Requires fee data from DLMM API
    isOutOfRange,
    alert,
  };
}
```

---

## The "Week 2 Death" Pattern — Recognition and Response

Week 2 is when most token launches fail. The pattern is consistent enough to predict and counter.

```
WEEK 2 DEATH SIGNATURE:
  Day 0-3:   Price pumps on launch hype (everyone watching)
  Day 4-7:   Price stabilizes or pulls back slightly (normal)
  Day 8-10:  Early airdrop farmers have waited out the 7-day tax threshold
             → First coordinated selling begins
  Day 11-14: If protocol team hasn't responded, price drops 40-70%
             → Remaining holders panic sell
             → This becomes self-fulfilling

EARLY WARNING SIGNS (watch from Day 5):
  - Sell/buy ratio trending up day over day (even if still <1)
  - Top 20 airdrop wallets starting to reduce positions
  - Volume declining faster than price (liquidity being removed quietly)
  - Discord activity dropping (engaged holders are vocal; disengaged ones leave silently)
  - New wallet creation for the token slowing below TGE rate

COUNTER-PLAYBOOK (execute before Day 10):
  1. Announce a staking program with meaningful APY funded from treasury
     → Locks up circulating supply, reduces sell pressure
     → Signal: team is investing in long-term holders

  2. Release a protocol milestone or product update
     → Give holders a reason to hold that isn't price
     → Even a small feature release signals momentum

  3. Execute a visible buyback
     → Doesn't need to be large — $50K buyback signals confidence
     → Tweet it with on-chain proof
     → "The team bought at these prices" is a powerful signal

  4. Community AMA within Day 8-10 window
     → Acknowledge the price action directly ("we see the price, here's our view")
     → Never pretend it's not happening — the community knows

  5. DO NOT:
     → Blame "market conditions" with no action plan
     → Post price predictions or "bullish" comments without substance
     → Go silent (silence = team is exiting too)
```

---

## Holder Quality Analysis

Not all holders are equal. Track the ratio of "quality" holders to total holders.

```typescript
// Quality holder signals:
// - Held through at least one >20% price drop without selling
// - Has interacted with the protocol (not just holding tokens)
// - Account age > 90 days
// - Holds tokens in a non-exchange wallet

async function analyzeHolderQuality(tokenMint: string): Promise<{
  totalHolders: number;
  qualityHolders: number;
  qualityRatio: number;
  riskConcentration: number;  // % held by top 10
  exchangeHeld: number;       // % sitting on CEX hot wallets
}> {
  // Fetch all token accounts via Helius DAS
  const holders = await fetchAllTokenHolders(tokenMint);
  const KNOWN_CEX_WALLETS = new Set([/* Binance, Coinbase, Kraken deposit addresses */]);

  const exchangeHeld = holders
    .filter((h) => KNOWN_CEX_WALLETS.has(h.address))
    .reduce((sum, h) => sum + h.amount, 0);

  const totalSupply = holders.reduce((sum, h) => sum + h.amount, 0);
  const top10Supply = holders
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10)
    .reduce((sum, h) => sum + h.amount, 0);

  return {
    totalHolders: holders.length,
    qualityHolders: 0, // Requires historical hold-through analysis
    qualityRatio: 0,
    riskConcentration: top10Supply / totalSupply,
    exchangeHeld: exchangeHeld / totalSupply,
  };
}
```
