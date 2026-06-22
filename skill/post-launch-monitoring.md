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
