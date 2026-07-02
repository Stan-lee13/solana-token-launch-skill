/**
 * Unit tests — Conviction-Weighted Airdrop Scoring (CWAS)
 * Framework: Vitest
 * Run: npx vitest run tests/unit/conviction-scoring.test.ts
 *
 * See skill/conviction-scoring.md for the full spec and rationale.
 */

import { describe, it, expect } from "vitest";
import {
  detectFundingClusters,
  clusterPenalty,
  entropyScore,
  computeConvictionScore,
  generateCommitHash,
  verifyReveal,
  WalletActivity,
} from "./conviction-scoring";

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

// ── Tests ────────────────────────────────────────────────────────────────────


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
