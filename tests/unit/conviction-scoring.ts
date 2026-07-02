/**
 * Reference implementation — Conviction-Weighted Airdrop Scoring (CWAS)
 * See skill/conviction-scoring.md and tests/unit/conviction-scoring.test.ts
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface WalletActivity {
  wallet: string;
  fundingSource: string;       // address that sent the first meaningful deposit
  fundingTimestamp: number;    // unix seconds
  accountAgeDays: number;
  txCount: number;
  protocolInteractions: number;
  activeMonths: number;
  txTimestamps: number[];      // unix seconds, used for entropy
}

export interface ClusterInfo {
  clusterId: string;
  clusterSize: number;
  members: string[];
}

export interface ConvictionResult {
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


