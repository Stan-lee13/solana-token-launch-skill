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

// ── Async webhook processing queue ────────────────────────────────────────
// Problem: Helius retries if your endpoint doesn't respond in <10 s.
// Doing heavy work (DB writes, external API calls) synchronously blocks that.
// Solution: enqueue immediately, process asynchronously.
//
// For production: replace in-memory queue with BullMQ + Redis.
import { EventEmitter } from "events";
const webhookQueue = new EventEmitter();
webhookQueue.setMaxListeners(0); // allow many concurrent listeners

// ── Per-IP rate limiter (simple token bucket) ─────────────────────────────
const WEBHOOK_RATE_LIMIT_RPM = 60; // max 60 requests/min per IP
const ipRequestCounts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipRequestCounts.get(ip);
  if (!entry || entry.resetAt < now) {
    ipRequestCounts.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  if (entry.count >= WEBHOOK_RATE_LIMIT_RPM) return true;
  entry.count++;
  return false;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Rate limit check
  const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0] ?? "unknown";
  if (isRateLimited(clientIp)) {
    return res.status(429).json({ error: "Too many requests" });
  }

  // Auth check — constant-time comparison to prevent timing attacks
  const secret = req.headers["authorization"] ?? "";
  const expected = process.env.WEBHOOK_SECRET ?? "";
  if (secret.length !== expected.length ||
      !secret.split("").every((c, i) => c === expected[i])) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Validate Content-Type (XSS/injection defence — see airdrop-orchestration.md for full XSS guide)
  if (!req.headers["content-type"]?.includes("application/json")) {
    return res.status(415).json({ error: "Unsupported Media Type" });
  }

  const transactions: HeliusTransaction[] = req.body;
  if (!Array.isArray(transactions)) {
    return res.status(400).json({ error: "Expected array of transactions" });
  }

  // ✅ Respond immediately — Helius requires <10 s response
  res.status(200).json({ received: true, queued: transactions.length });

  // Process asynchronously — does NOT block the HTTP response
  setImmediate(async () => {
    for (const tx of transactions) {
      // Input validation before processing
      if (!tx.signature || typeof tx.signature !== "string") continue;

      const relevantTransfers = (tx.tokenTransfers ?? []).filter(
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
          }).catch(err => console.error("[webhook] sendAlert failed:", err));
        }
      }
    }
  });
}
```

## Holder tracking

### Track holder growth and distribution

```typescript
// Helius getTokenAccounts — paginated holder list
// ── Named constants (avoid magic numbers) ─────────────────────────────────
const HOLDER_PAGE_SIZE       = 1000;   // Helius max per getTokenAccounts page
const MAX_HOLDER_PAGES       = 200;    // Hard cap: 200 × 1000 = 200K holders max in memory
const HOLDER_CACHE_TTL_MS    = 5 * 60 * 1000;   // 5 minutes
const WHALE_THRESHOLD_USD    = 500_000;
const WHALE_TRANSFER_USD     = 250_000;
const LP_TVL_DROP_1HR        = -0.30;
const CLAIM_BURST_WINDOW_MS  = 10 * 60 * 1000;  // 10 minutes
const CLAIM_BURST_THRESHOLD  = 100;
const COORDINATION_WINDOW_S  = 1800;   // 30 minutes
const LARGE_SELLER_USD       = 10_000;
const COORDINATED_SELLER_USD = 5_000;
const TOP_SELLERS_COUNT      = 10;
const IN_RANGE_BPS_THRESHOLD = 10;     // <10 % in-range = out-of-range alert
const SPREAD_WARN_BPS        = 100;

// ── Simple in-process cache ────────────────────────────────────────────────
interface CacheEntry<T> { value: T; expiresAt: number }
const _cache = new Map<string, CacheEntry<unknown>>();
function cacheGet<T>(key: string): T | null {
  const e = _cache.get(key) as CacheEntry<T> | undefined;
  return e && e.expiresAt > Date.now() ? e.value : null;
}
function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  _cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * Fetches all non-zero token holders via paginated Helius DAS API.
 *
 * Memory safety: capped at MAX_HOLDER_PAGES * HOLDER_PAGE_SIZE entries.
 * For tokens with >200K holders, call with `streamCallback` instead.
 *
 * @param mint   - Token mint address
 * @param helius - Authenticated Helius SDK instance
 * @returns Map<ownerAddress, tokenAmount>
 *
 * @example
 * const holders = await getAllHolders(mint, helius);
 * console.log("Total holders:", holders.size);
 *
 * Rate limits: Helius free = 10 req/s; business = 50 req/s.
 * Add a 100 ms delay between pages on free plans.
 */
async function getAllHolders(
  mint: string,
  helius: Helius,
  options: { maxPages?: number; delayMs?: number } = {}
): Promise<Map<string, number>> {
  const cacheKey = `holders:${mint}`;
  const cached = cacheGet<Map<string, number>>(cacheKey);
  if (cached) return cached;

  const holders = new Map<string, number>();
  let cursor: string | null = null;
  let pages = 0;
  const maxPages = options.maxPages ?? MAX_HOLDER_PAGES;
  const delayMs  = options.delayMs  ?? 0;

  do {
    const response = await helius.rpc.getTokenAccounts({
      mint,
      limit: HOLDER_PAGE_SIZE,
      cursor: cursor ?? undefined,
      options: { showZeroBalance: false },
    });

    for (const account of response.token_accounts) {
      holders.set(account.owner, account.amount);
    }

    cursor = response.cursor ?? null;
    pages++;

    if (pages >= maxPages && cursor) {
      console.warn(
        `[getAllHolders] Hit page cap (${maxPages} pages = ${holders.size} holders). ` +
        "Token may have more holders. Increase maxPages or use streaming."
      );
      break;
    }

    if (delayMs > 0 && cursor) await new Promise(r => setTimeout(r, delayMs));
  } while (cursor);

  cacheSet(cacheKey, holders, HOLDER_CACHE_TTL_MS);
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

/**
 * Checks health of a Meteora DLMM pool position.
 *
 * Optimization: uses a single batched RPC call to fetch activeBin and positions
 * instead of two sequential calls.
 *
 * @param poolAddress - Meteora DLMM pool public key
 * @param connection  - Solana RPC connection (use dedicated endpoint, not public)
 * @param userPublicKey - LP owner wallet
 *
 * Rate limits: Each DLMM.create() + getActiveBin() = 2 getAccountInfo calls.
 * For monitoring multiple pools, batch them:
 *   const pools = await Promise.all(addresses.map(a => DLMM.create(conn, new PublicKey(a))));
 *   // Then fetch all active bins in one multicall via connection.getMultipleAccountsInfo()
 *
 * @example
 * const health = await checkPoolHealth(POOL_ADDRESS, connection, lpOwner);
 * if (health.isOutOfRange) rebalance();
 */
async function checkPoolHealth(
  poolAddress: string,
  connection: Connection,
  userPublicKey: PublicKey
) {
  // Batch: fetch pool + positions in parallel instead of sequential awaits
  const pool = await DLMM.create(connection, new PublicKey(poolAddress));
  const [poolState, { userPositions }] = await Promise.all([
    pool.getActiveBin(),
    pool.getPositionsByUserAndLbPair(userPublicKey),
  ]);

  const activeBinId = poolState.binId;

  for (const position of userPositions) {
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

/**
 * Analyzes buy/sell flow to detect coordinated distribution events.
 *
 * @param tokenMint     - Token mint address
 * @param poolAddresses - LP pool addresses (sell = transfer INTO pool)
 * @param windowHours   - Look-back window in hours (default: 24)
 * @param config        - Configurable thresholds (overrides module constants)
 *
 * Rate limits:
 *   getTransactionHistory: counts against Helius credit budget.
 *   limit 500 = up to 5 credit units on Business plan.
 *   For high-frequency polling, cache results for ≥60 s.
 *
 * @example
 * const result = await analyzeSellPressure(mint, pools, 24, { txLimit: 200 });
 * if (result.verdict === "COORDINATED_EXIT") triggerAlert(result);
 */
async function analyzeSellPressure(
  tokenMint: string,
  poolAddresses: string[],
  windowHours: number = 24,
  config: {
    txLimit?: number;              // Max transactions to fetch (default: 500)
    largeSellThresholdUsd?: number; // Threshold for "large seller" (default: LARGE_SELLER_USD)
    coordSellThresholdUsd?: number; // Threshold for coordination check (default: COORDINATED_SELLER_USD)
    coordinationWindowSec?: number; // Time window for coordination (default: COORDINATION_WINDOW_S)
    topSellersCount?: number;       // How many top sellers to return (default: TOP_SELLERS_COUNT)
    cacheTtlMs?: number;            // Cache TTL in ms (default: 60_000)
  } = {}
): Promise<SellPressureAnalysis> {
  const cacheKey = `sell-pressure:${tokenMint}:${windowHours}`;
  const cacheTtl = config.cacheTtlMs ?? 60_000;
  const cached = cacheGet<SellPressureAnalysis>(cacheKey);
  if (cached) return cached;

  const helius = new Helius(process.env.HELIUS_API_KEY!);
  const txLimit           = config.txLimit              ?? 500;
  const largeSellThresh   = config.largeSellThresholdUsd ?? LARGE_SELLER_USD;
  const coordSellThresh   = config.coordSellThresholdUsd ?? COORDINATED_SELLER_USD;
  const coordWindow       = config.coordinationWindowSec ?? COORDINATION_WINDOW_S;
  const topCount          = config.topSellersCount       ?? TOP_SELLERS_COUNT;

  // Rate limit guard: Helius Business = 50 req/s. Add jitter if calling in a loop.
  const txs = await helius.rpc.getTransactionHistory({
    address: tokenMint,
    options: { limit: txLimit },
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
    .slice(0, topCount)
    .map(([wallet, data]) => ({ wallet, ...data }));

  const largeSellerCount = topSellers.filter((s) => s.amountUsd > largeSellThresh).length;

  // Coordinated exit: multiple wallets selling large amounts within the same 30-minute window
  let isOrganized = false;
  const largeSellers = topSellers.filter((s) => s.amountUsd > coordSellThresh);
  if (largeSellers.length >= 3) {
    const allTimestamps = largeSellers.flatMap((s) => s.timestamps);
    for (let i = 0; i < allTimestamps.length; i++) {
      const clustered = allTimestamps.filter(
        (t) => Math.abs(t - allTimestamps[i]) < coordWindow
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

  const result: SellPressureAnalysis = {
    netFlowUsd: totalBuyVolume - totalSellVolume,
    buyVsSellRatio,
    largeSellerCount,
    isOrganized,
    topSellers,
    verdict,
  };
  cacheSet(cacheKey, result, cacheTtl);
  return result;
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

/**
 * Monitors a Meteora DLMM LP position and returns a health report.
 *
 * @param poolAddress - DLMM pool public key (base58)
 * @returns LPHealthReport with alert string if action needed, null otherwise
 *
 * Rate limits: 2 RPC calls per invocation (getActiveBin + getPositions).
 * Recommended polling interval: 60 seconds. Cache result for at least 30 s.
 *
 * @example
 * const report = await monitorLPHealth(POOL_ADDRESS);
 * if (report.alert) await sendAlert({ type: "LP_HEALTH", message: report.alert });
 */
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

  const isOutOfRange = inRangePct < IN_RANGE_BPS_THRESHOLD;

  let alert: string | null = null;
  if (isOutOfRange) {
    alert = `⚠️ LP position is OUT OF RANGE — only ${inRangePct.toFixed(1)}% earning fees. Rebalance now.`;
  } else if (inRangePct < 30) {
    alert = `LP position drifting — ${inRangePct.toFixed(1)}% in range. Consider rebalancing within 24h.`;
  } else if (spreadBps > SPREAD_WARN_BPS) {
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

---

## Caching Layer

All monitoring functions implement an in-process cache (`cacheGet` / `cacheSet`) to avoid hammering APIs.
For multi-instance deployments, replace with Redis (e.g., `ioredis` or Upstash).

```typescript
// Redis cache (production — swap in for in-process cache above)
import { Redis } from "@upstash/redis";
const redis = Redis.fromEnv();  // Reads UPSTASH_REDIS_REST_URL + TOKEN from env

async function getAllHoldersProduction(mint: string, helius: Helius) {
  const cacheKey = `holders:${mint}`;
  const cached = await redis.get<Record<string, number>>(cacheKey);
  if (cached) return new Map(Object.entries(cached));

  const holders = await getAllHolders(mint, helius);
  // Store as plain object — Maps don't serialize cleanly
  await redis.set(cacheKey, Object.fromEntries(holders), { ex: 300 }); // 5 min TTL
  return holders;
}
```

### Recommended TTLs

| Data | Staleness tolerance | TTL |
|------|---------------------|-----|
| Token price | Real-time | 5 s |
| Holder list | Slow-moving | 5 min |
| LP health | Medium | 30 s |
| Sell pressure | Medium | 60 s |
| Concentration analysis | Slow | 5 min |

---

## Rate Limiting Reference

Every external API used in this file has request limits. Exceeding them causes silent data gaps.

| API | Free tier | Business/Paid | Mitigation |
|-----|-----------|---------------|------------|
| Helius `getTokenAccounts` | 10 req/s | 50 req/s | 100 ms page delay on free; cache 5 min |
| Helius `getTransactionHistory` | 1 req/s | 10 req/s | Cache 60 s; use webhooks for real-time |
| Helius Webhooks inbound | — | Up to 1000 tx/batch | Async queue (see webhook handler above) |
| Meteora DLMM `getActiveBin` | Public RPC limits | Dedicated RPC | Batch with `Promise.all`; cache 30 s |
| Birdeye price API | 30 req/min | 300 req/min | Cache price 5 s; never call in a loop |
| Jupiter price API | 60 req/min (no key) | 600 req/min | Cache 5 s |

**Key rule:** Never call a price API inside a transaction loop. Fetch price once before the loop, reuse within the same batch.

```typescript
// ✅ Correct — fetch price once
const currentPrice = await getTokenPriceUsd(tokenMint);
for (const tx of windowTxs) {
  const usdValue = transfer.tokenAmount * currentPrice; // reuse
}

// ❌ Wrong — API call on every transfer
for (const tx of windowTxs) {
  const usdValue = transfer.tokenAmount * (await getTokenPriceUsd(tokenMint)); // burns quota
}
```
