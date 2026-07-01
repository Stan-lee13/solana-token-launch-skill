/**
 * Unit tests — Conviction-Weighted Airdrop Scoring (CWAS)
 * Framework: Vitest
 * Run: npx vitest run tests/unit/conviction-scoring.test.ts
 *
 * See skill/conviction-scoring.md for the full spec and rationale.
 *
 * WHY THIS EXISTS: the standard anti-sybil approach (skill/airdrop-orchestration.md's
 * "Filter 1-5") is a set of static, binary pass/fail thresholds — min balance, min age,
 * min tx count. Sybil farms trivially clear all of them: age a wallet 31 days, do 11
 * throwaway transactions, done. Those filters catch nobody sophisticated enough to read
 * a blog post about airdrop farming, which by 2024+ is nearly all of them.
 *
 * CWAS replaces binary filters with a continuous composite score built from signals
 * that are expensive/impossible to fake at scale:
 *   1. Funding-cluster detection — sybil farms fund N wallets from ONE source in a
 *      tight time window (gas efficiency forces this). Genuine users don't share a
 *      funding source with hundreds of other "unrelated" wallets.
 *   2. Temporal entropy — scripted farming bots transact in tight, repeatable time
 *      patterns. Organic human usage is naturally higher-entropy across hour-of-day.
 *   3. Cross-protocol depth — continuous, not a binary "used >= 2 protocols" cliff.
 */

import { describe, it, expect } from "vitest";

// ── Types ────────────────────────────────────────────────────────────────────

interface WalletActivity {
  wallet: string;
  fundingSource: string;       // address that sent the first meaningful deposit
  fundingTimestamp: number;    // unix seconds
  accountAgeDays: number;
  txCount: number;
  protocolInteractions: number;
  activeMonths: number;
  txTimestamps: number[];      // unix seconds, used for entropy
}

interface ClusterInfo {
  clusterId: string;
  clusterSize: number;
  members: string[];
}

interface ConvictionResult {
  wallet: string;
  clusterPenalty: number;      // 0 (no penalty) to 1 (max penalty)
  entropyScore: number;        // 0-1, higher = more organic/human-like
  depthScore: number;          // 0-1, continuous protocol/tenure depth
  convictionScore: number;     // final 0-100 composite
  flagged: boolean;            // true if convictionScore < threshold
}

const CLUSTER_WINDOW_SECONDS = 10 * 60;      // wallets funded from the same source within
                                              // this window are considered co-funded
const SYBIL_CLUSTER_FLAG_THRESHOLD = 8;      // cluster size at which penalty saturates
const CONVICTION_FLAG_THRESHOLD = 35;        // composite score below this = manual review

// ── 1. Funding-cluster detection ────────────────────────────────────────────
//
// Groups wallets that share a funding source AND were funded within
// CLUSTER_WINDOW_SECONDS of each other. This catches the single most common
// sybil-farm signature: one hot wallet fans out SOL to hundreds of fresh
// wallets in a tight batch, because gas/time cost makes staggering them
// expensive at scale. A legitimate large funding source (e.g., a CEX hot
// wallet) will show up as a cluster too — that's expected, and is why cluster
// membership feeds a PENALTY into a composite score rather than an outright
// exclusion; see conviction-scoring.md's disclosure on CEX false-positives.
export function detectFundingClusters(wallets: WalletActivity[]): Map<string, ClusterInfo> {
  const byFundingSource = new Map<string, WalletActivity[]>();
  for (const w of wallets) {
    const bucket = byFundingSource.get(w.fundingSource) ?? [];
    bucket.push(w);
    byFundingSource.set(w.fundingSource, bucket);
  }

  const clusterOf = new Map<string, ClusterInfo>();
  let clusterCounter = 0;

  for (const [source, group] of byFundingSource) {
    // Sort by funding timestamp, then greedily bucket wallets into
    // sub-clusters using the time window (a single funding source active over
    // months shouldn't count as one giant cluster — only tight time bursts).
    const sorted = [...group].sort((a, b) => a.fundingTimestamp - b.fundingTimestamp);
    let currentBucket: WalletActivity[] = [];
    let bucketStart = -Infinity;

    const flushBucket = () => {
      if (currentBucket.length === 0) return;
      const clusterId = `${source}-${clusterCounter++}`;
      const members = currentBucket.map((w) => w.wallet);
      const info: ClusterInfo = { clusterId, clusterSize: members.length, members };
      for (const m of members) clusterOf.set(m, info);
      currentBucket = [];
    };

    for (const w of sorted) {
      if (w.fundingTimestamp - bucketStart > CLUSTER_WINDOW_SECONDS) {
        flushBucket();
        bucketStart = w.fundingTimestamp;
      }
      currentBucket.push(w);
    }
    flushBucket();
  }

  return clusterOf;
}

export function clusterPenalty(clusterSize: number): number {
  if (clusterSize <= 1) return 0;
  // Saturating penalty — a cluster of 2 (could be a couple, a small team) is
  // barely penalized; a cluster of SYBIL_CLUSTER_FLAG_THRESHOLD+ (classic
  // farm fan-out) saturates near-max penalty.
  return Math.min((clusterSize - 1) / (SYBIL_CLUSTER_FLAG_THRESHOLD - 1), 1);
}

// ── 2. Temporal entropy ─────────────────────────────────────────────────────
//
// Shannon entropy of transaction timestamps binned by hour-of-day (0-23).
// Real human usage spreads across a personal but non-uniform daily pattern
// (some hours much more active than others, but not IDENTICAL every day).
// Scripted farming bots often fire at fixed intervals or fixed hours across
// a whole farm, collapsing entropy toward zero for that population, or -
// paradoxically - toward perfectly uniform (equally likely at every hour,
// which real humans essentially never are, since everyone sleeps sometime).
// We flag BOTH extremes as suspicious via a distance-from-typical-human-range check.
export function hourOfDayEntropy(timestamps: number[]): number {
  if (timestamps.length === 0) return 0;
  const bins = new Array(24).fill(0);
  for (const t of timestamps) {
    const hour = new Date(t * 1000).getUTCHours();
    bins[hour]++;
  }
  const total = timestamps.length;
  let entropy = 0;
  for (const count of bins) {
    if (count === 0) continue;
    const p = count / total;
    entropy -= p * Math.log2(p);
  }
  const maxEntropy = Math.log2(24); // uniform distribution across 24 hours
  return entropy / maxEntropy;      // normalized 0-1
}

export function entropyScore(timestamps: number[]): number {
  if (timestamps.length < 3) return 0.5; // insufficient data — neutral, don't punish new wallets alone
  const normalized = hourOfDayEntropy(timestamps);
  // Human activity typically normalizes to roughly 0.55-0.85 (concentrated but
  // not robotic). Perfectly uniform (>0.95, active literally every hour
  // equally, a farm bot round-robining wallets) and near-zero (<0.15, one
  // exact repeated timestamp pattern, a scripted bot) both score low.
  if (normalized > 0.95 || normalized < 0.15) return 0.1;
  const distanceFromIdeal = Math.abs(normalized - 0.7);
  return Math.max(1 - distanceFromIdeal * 2, 0.2);
}

// ── 3. Composite conviction score ───────────────────────────────────────────

export function computeConvictionScore(
  wallet: WalletActivity,
  clusters: Map<string, ClusterInfo>
): ConvictionResult {
  const cluster = clusters.get(wallet.wallet);
  const penalty = clusterPenalty(cluster?.clusterSize ?? 1);
  const entropy = entropyScore(wallet.txTimestamps);

  const ageDepth = Math.min(wallet.accountAgeDays / 180, 1);           // saturates at 6 months
  const txDepth = Math.min(wallet.txCount / 100, 1);                  // saturates at 100 txs
  const protocolDepth = Math.min(wallet.protocolInteractions / 6, 1); // saturates at 6 protocols
  const monthsDepth = Math.min(wallet.activeMonths / 6, 1);           // saturates at 6 active months
  const depth = (ageDepth + txDepth + protocolDepth + monthsDepth) / 4;

  // Composite: depth and entropy are POSITIVE signals; cluster penalty SUBTRACTS.
  // Weights: depth 45%, entropy 25%, cluster penalty up to -30%.
  const raw = depth * 45 + entropy * 25 + (1 - penalty) * 30;
  const convictionScore = Math.max(0, Math.min(100, raw));

  return {
    wallet: wallet.wallet,
    clusterPenalty: penalty,
    entropyScore: entropy,
    depthScore: depth,
    convictionScore,
    flagged: convictionScore < CONVICTION_FLAG_THRESHOLD,
  };
}

// ── 4. Commit-reveal claim mechanism ────────────────────────────────────────
//
// A standard open Merkle-proof claim is front-runnable: a bot watching the
// mempool sees a valid claim transaction, and — where claim amounts are
// public in the Merkle leaf data or derivable — can attempt to race or
// sandwich it. Commit-reveal defers revealing the actual proof/amount:
//   1. COMMIT phase: user submits hash(wallet || secret || nonce) on-chain.
//      Nothing about eligibility or amount is revealed yet.
//   2. Commit window closes (e.g., 24h) — no more commits accepted.
//   3. REVEAL phase: user submits (secret, nonce); contract recomputes the
//      hash and only THEN checks Merkle eligibility and releases funds.
// This mirrors Solana's client-side simplicity requirements — the "hash" here
// would be a keccak256/sha256 computed client-side and stored in the
// program's commit account (see stabilization-vault.md and
// wallet-tge-security.md for the on-chain account patterns this composes with).
import { createHash } from "crypto";

export function generateCommitHash(wallet: string, secret: string, nonce: string): string {
  return createHash("sha256").update(`${wallet}:${secret}:${nonce}`).digest("hex");
}

export function verifyReveal(
  commitHash: string,
  wallet: string,
  secret: string,
  nonce: string
): boolean {
  return generateCommitHash(wallet, secret, nonce) === commitHash;
}

// ── Tests ────────────────────────────────────────────────────────────────────

function mkWallet(overrides: Partial<WalletActivity> = {}): WalletActivity {
  return {
    wallet: "wallet-default",
    fundingSource: "source-default",
    fundingTimestamp: 1_700_000_000,
    accountAgeDays: 5,
    txCount: 3,
    protocolInteractions: 0,
    activeMonths: 1,
    txTimestamps: [1_700_000_000],
    ...overrides,
  };
}

describe("funding cluster detection", () => {
  it("groups wallets funded from the same source within the time window", () => {
    const wallets = Array.from({ length: 10 }, (_, i) =>
      mkWallet({
        wallet: `sybil-${i}`,
        fundingSource: "farm-hot-wallet",
        fundingTimestamp: 1_700_000_000 + i * 30, // 30s apart — well within 10min window
      })
    );
    const clusters = detectFundingClusters(wallets);
    const cluster = clusters.get("sybil-0")!;
    expect(cluster.clusterSize).toBe(10);
  });

  it("does NOT cluster wallets funded from the same source but far apart in time", () => {
    const wallets = [
      mkWallet({ wallet: "w1", fundingSource: "cex-hotwallet", fundingTimestamp: 1_700_000_000 }),
      mkWallet({ wallet: "w2", fundingSource: "cex-hotwallet", fundingTimestamp: 1_700_000_000 + 86400 * 30 }),
    ];
    const clusters = detectFundingClusters(wallets);
    expect(clusters.get("w1")!.clusterSize).toBe(1);
    expect(clusters.get("w2")!.clusterSize).toBe(1);
  });

  it("does not cluster wallets with different funding sources", () => {
    const wallets = [
      mkWallet({ wallet: "w1", fundingSource: "source-a", fundingTimestamp: 1_700_000_000 }),
      mkWallet({ wallet: "w2", fundingSource: "source-b", fundingTimestamp: 1_700_000_010 }),
    ];
    const clusters = detectFundingClusters(wallets);
    expect(clusters.get("w1")!.clusterSize).toBe(1);
    expect(clusters.get("w2")!.clusterSize).toBe(1);
  });

  it("clusterPenalty saturates at SYBIL_CLUSTER_FLAG_THRESHOLD and is 0 for solo wallets", () => {
    expect(clusterPenalty(1)).toBe(0);
    expect(clusterPenalty(8)).toBe(1);
    expect(clusterPenalty(20)).toBe(1); // clamped, doesn't exceed 1
    expect(clusterPenalty(4)).toBeCloseTo(3 / 7, 5);
  });
});

describe("temporal entropy", () => {
  it("flags a bot firing at the exact same hour every time as low entropy", () => {
    const timestamps = Array.from({ length: 30 }, (_, i) => 1_700_000_000 + i * 86400); // same hour, daily
    const score = entropyScore(timestamps);
    expect(score).toBeLessThan(0.3);
  });

  it("gives a healthy score to activity spread naturally across several hours", () => {
    // Simulate a human who's usually active 14:00-22:00 with some variance
    const hours = [14, 15, 16, 18, 19, 20, 21, 22, 15, 17, 19, 20];
    const timestamps = hours.map((h, i) => Date.UTC(2024, 0, 1 + i, h) / 1000);
    const score = entropyScore(timestamps);
    expect(score).toBeGreaterThan(0.4);
  });

  it("flags perfectly uniform round-the-clock activity as suspicious too", () => {
    // 24 timestamps, one per hour — a farm bot round-robining across wallets
    const timestamps = Array.from({ length: 24 }, (_, h) => Date.UTC(2024, 0, 1, h) / 1000);
    const score = entropyScore(timestamps);
    expect(score).toBeLessThan(0.3);
  });

  it("returns a neutral score for wallets with too little data to judge", () => {
    expect(entropyScore([1_700_000_000])).toBe(0.5);
    // Zero data points is the MOST insufficient case, not the most suspicious one —
    // it should stay neutral (same branch as the single-timestamp case).
    expect(entropyScore([])).toBe(0.5);
  });
});

describe("composite conviction score", () => {
  it("scores a genuine long-tenured, multi-protocol, solo-funded wallet highly", () => {
    const genuine = mkWallet({
      wallet: "genuine-user",
      fundingSource: "unique-personal-wallet",
      accountAgeDays: 400,
      txCount: 150,
      protocolInteractions: 8,
      activeMonths: 8,
      txTimestamps: [14, 16, 19, 21, 15, 18, 20, 22, 17].map(
        (h, i) => Date.UTC(2024, 0, 1 + i * 3, h) / 1000
      ),
    });
    const clusters = detectFundingClusters([genuine]);
    const result = computeConvictionScore(genuine, clusters);
    expect(result.convictionScore).toBeGreaterThan(60);
    expect(result.flagged).toBe(false);
  });

  it("scores a fresh, low-tenure, cluster-funded farm wallet poorly", () => {
    const farmWallets = Array.from({ length: 12 }, (_, i) =>
      mkWallet({
        wallet: `farm-${i}`,
        fundingSource: "farm-hotwallet",
        fundingTimestamp: 1_700_000_000 + i * 20,
        accountAgeDays: 32,       // clears the old static "min age 30 days" filter
        txCount: 11,              // clears the old static "min tx count 10" filter
        protocolInteractions: 0,
        activeMonths: 1,
        txTimestamps: [1_700_000_000 + i * 20], // identical narrow window across the farm
      })
    );
    const clusters = detectFundingClusters(farmWallets);
    const result = computeConvictionScore(farmWallets[0], clusters);
    // This exact wallet would PASS every binary filter in airdrop-orchestration.md's
    // "Filter 1-5" list, yet CWAS should still flag it via cluster penalty.
    expect(result.clusterPenalty).toBeGreaterThan(0.9);
    expect(result.flagged).toBe(true);
  });

  it("does not over-punish a large but loosely-time-spread CEX-funded cohort", () => {
    // 10 genuine users who all happened to withdraw from the same CEX hot wallet,
    // but spread across weeks, not minutes — should NOT cluster-penalize like a farm.
    const wallets = Array.from({ length: 10 }, (_, i) =>
      mkWallet({
        wallet: `cex-user-${i}`,
        fundingSource: "binance-hotwallet-14",
        fundingTimestamp: 1_700_000_000 + i * 86400 * 4, // 4 days apart
        accountAgeDays: 200,
        txCount: 60,
        protocolInteractions: 4,
        activeMonths: 5,
        txTimestamps: [14, 17, 20].map((h, j) => Date.UTC(2024, 0, 1 + i + j * 2, h) / 1000),
      })
    );
    const clusters = detectFundingClusters(wallets);
    const result = computeConvictionScore(wallets[0], clusters);
    expect(result.clusterPenalty).toBe(0);
    expect(result.flagged).toBe(false);
  });
});

describe("commit-reveal claim mechanism", () => {
  it("verifies a matching reveal against its commit hash", () => {
    const commit = generateCommitHash("walletA", "supersecret", "nonce123");
    expect(verifyReveal(commit, "walletA", "supersecret", "nonce123")).toBe(true);
  });

  it("rejects a reveal with a tampered secret", () => {
    const commit = generateCommitHash("walletA", "supersecret", "nonce123");
    expect(verifyReveal(commit, "walletA", "wrongsecret", "nonce123")).toBe(false);
  });

  it("rejects a reveal with a tampered wallet address", () => {
    const commit = generateCommitHash("walletA", "supersecret", "nonce123");
    expect(verifyReveal(commit, "walletB", "supersecret", "nonce123")).toBe(false);
  });

  it("produces different hashes for different nonces (prevents replay across rounds)", () => {
    const commit1 = generateCommitHash("walletA", "supersecret", "nonce1");
    const commit2 = generateCommitHash("walletA", "supersecret", "nonce2");
    expect(commit1).not.toBe(commit2);
  });
});
