/**
 * Unit tests — Sell Pressure Analyzer
 * Framework: Vitest
 * Run: npx vitest run tests/unit/sell-pressure-analyzer.test.ts
 */

import { describe, it, expect } from "vitest";

// ── Types ────────────────────────────────────────────────────────────────────
type Verdict = "HEALTHY" | "WATCH" | "HEAVY_DISTRIBUTION" | "COORDINATED_EXIT";

interface SellerData {
  wallet: string;
  amountUsd: number;
  txCount: number;
  timestamps: number[];
}

interface SellPressureResult {
  netFlowUsd: number;
  buyVsSellRatio: number;
  largeSellerCount: number;
  isOrganized: boolean;
  topSellers: SellerData[];
  verdict: Verdict;
}

// ── Pure logic under test (extracted from analyzeSellPressure) ───────────────
function computeVerdict(
  buyVolume: number,
  sellVolume: number,
  sellers: SellerData[],
  largeSellThresh: number = 10_000,
  coordSellThresh: number = 5_000,
  coordWindowSec: number = 1800
): SellPressureResult {
  const buyVsSellRatio = buyVolume / Math.max(sellVolume, 1);
  const topSellers = [...sellers]
    .sort((a, b) => b.amountUsd - a.amountUsd)
    .slice(0, 10);

  const largeSellerCount = topSellers.filter(s => s.amountUsd > largeSellThresh).length;

  let isOrganized = false;
  const largeSellers = topSellers.filter(s => s.amountUsd > coordSellThresh);
  if (largeSellers.length >= 3) {
    const allTs = largeSellers.flatMap(s => s.timestamps);
    for (let i = 0; i < allTs.length; i++) {
      const cluster = allTs.filter(t => Math.abs(t - allTs[i]) < coordWindowSec);
      if (cluster.length >= 3) { isOrganized = true; break; }
    }
  }

  const verdict: Verdict =
    isOrganized                                  ? "COORDINATED_EXIT" :
    buyVsSellRatio < 0.5 && largeSellerCount > 5 ? "HEAVY_DISTRIBUTION" :
    buyVsSellRatio < 0.7                         ? "WATCH" :
    "HEALTHY";

  return {
    netFlowUsd: buyVolume - sellVolume,
    buyVsSellRatio,
    largeSellerCount,
    isOrganized,
    topSellers,
    verdict,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────
const NOW = 1_700_000_000;

describe("sell pressure verdict", () => {
  it("HEALTHY when buy > sell", () => {
    const r = computeVerdict(100_000, 40_000, []);
    expect(r.verdict).toBe("HEALTHY");
    expect(r.buyVsSellRatio).toBeCloseTo(2.5);
    expect(r.netFlowUsd).toBe(60_000);
  });

  it("WATCH when buy/sell ratio 0.5-0.7", () => {
    const r = computeVerdict(60_000, 100_000, []);
    expect(r.verdict).toBe("WATCH");
  });

  it("HEAVY_DISTRIBUTION when ratio <0.5 and >5 large sellers", () => {
    // Each seller needs a DISTINCT timestamp spaced well outside the 30-min (1800s)
    // coordination window — otherwise every seller collapses into one coordinated
    // cluster and the verdict short-circuits to COORDINATED_EXIT before ever
    // reaching the HEAVY_DISTRIBUTION branch (that's a *correct* precedence: an
    // organized dump is more severe than generic distribution — the test data
    // just has to actually represent uncoordinated selling).
    const sellers: SellerData[] = Array.from({ length: 8 }, (_, i) => ({
      wallet: `wallet${i}`, amountUsd: 15_000, txCount: 1,
      timestamps: [NOW - 3600 * (i + 1)], // 1h, 2h, 3h... apart — never clusters
    }));
    const r = computeVerdict(20_000, 120_000, sellers);
    expect(r.verdict).toBe("HEAVY_DISTRIBUTION");
    expect(r.largeSellerCount).toBe(8);
    expect(r.isOrganized).toBe(false);
  });

  it("COORDINATED_EXIT when 3+ large sellers act within 30-min window", () => {
    const sellers: SellerData[] = Array.from({ length: 5 }, (_, i) => ({
      wallet: `wallet${i}`, amountUsd: 8_000, txCount: 1,
      timestamps: [NOW, NOW + 300, NOW + 600], // all within 10 min
    }));
    const r = computeVerdict(10_000, 80_000, sellers);
    expect(r.verdict).toBe("COORDINATED_EXIT");
    expect(r.isOrganized).toBe(true);
  });

  it("NOT coordinated when sellers act in different time windows", () => {
    const sellers: SellerData[] = [
      { wallet: "a", amountUsd: 8_000, txCount: 1, timestamps: [NOW] },
      { wallet: "b", amountUsd: 8_000, txCount: 1, timestamps: [NOW + 7200] }, // 2h later
      { wallet: "c", amountUsd: 8_000, txCount: 1, timestamps: [NOW + 14400] }, // 4h later
    ];
    const r = computeVerdict(10_000, 80_000, sellers);
    expect(r.isOrganized).toBe(false);
  });

  it("netFlowUsd is negative when selling exceeds buying", () => {
    const r = computeVerdict(30_000, 100_000, []);
    expect(r.netFlowUsd).toBe(-70_000);
  });

  it("handles zero sell volume without division error", () => {
    expect(() => computeVerdict(50_000, 0, [])).not.toThrow();
    const r = computeVerdict(50_000, 0, []);
    expect(r.buyVsSellRatio).toBe(50_000);
  });

  it("configurable largeSellThreshold changes largeSellerCount", () => {
    const sellers: SellerData[] = [
      { wallet: "a", amountUsd: 6_000, txCount: 1, timestamps: [NOW] },
    ];
    const defaultR = computeVerdict(50_000, 50_000, sellers, 10_000); // threshold 10K
    const lowR     = computeVerdict(50_000, 50_000, sellers, 5_000);  // threshold 5K
    expect(defaultR.largeSellerCount).toBe(0);
    expect(lowR.largeSellerCount).toBe(1);
  });

  it("topSellers limited to 10 entries", () => {
    const sellers: SellerData[] = Array.from({ length: 20 }, (_, i) => ({
      wallet: `wallet${i}`, amountUsd: i * 1000, txCount: 1, timestamps: [NOW],
    }));
    const r = computeVerdict(50_000, 200_000, sellers);
    expect(r.topSellers.length).toBeLessThanOrEqual(10);
  });

  it("topSellers are sorted descending by amountUsd", () => {
    const sellers: SellerData[] = [
      { wallet: "small", amountUsd: 1_000, txCount: 1, timestamps: [NOW] },
      { wallet: "large", amountUsd: 50_000, txCount: 1, timestamps: [NOW] },
      { wallet: "mid",   amountUsd: 10_000, txCount: 1, timestamps: [NOW] },
    ];
    const r = computeVerdict(10_000, 100_000, sellers);
    expect(r.topSellers[0].wallet).toBe("large");
    expect(r.topSellers[1].wallet).toBe("mid");
  });
});
