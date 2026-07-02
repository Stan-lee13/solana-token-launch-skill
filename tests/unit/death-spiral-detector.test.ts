/**
 * Unit tests — Death Spiral Detector
 * Framework: Vitest (drop-in Jest compatible)
 * Run: npx vitest run tests/unit/death-spiral-detector.test.ts
 */

import { describe, it, expect } from "vitest";
import { detectDeathSpiral, TokenomicsSnapshot } from "./death-spiral-detector";

// ── Tests ────────────────────────────────────────────────────────────────────
describe("detectDeathSpiral", () => {
  const healthySnap: TokenomicsSnapshot = {
    price_usd: 1.00,
    circulating_supply: 100_000_000,
    daily_emission_tokens: 100_000,
    daily_fee_revenue_usd: 200_000,
    lp_tvl_usd: 10_000_000,
    holder_count: 10_000,
    buy_sell_ratio_7d: 1.2,
  };

  it("returns SAFE for a healthy protocol", () => {
    const result = detectDeathSpiral(healthySnap);
    expect(result.risk).toBe("SAFE");
    expect(result.score).toBeLessThan(20);
    expect(result.triggers).toHaveLength(0);
  });

  it("flags HEAVY_SELL_PRESSURE when buy/sell ratio < 0.5", () => {
    const snap = { ...healthySnap, buy_sell_ratio_7d: 0.3 };
    const result = detectDeathSpiral(snap);
    expect(result.triggers).toContain("HEAVY_SELL_PRESSURE");
    expect(result.score).toBeGreaterThanOrEqual(30);
  });

  it("flags EMISSIONS_UNSUSTAINABLE when emissions > 10× fee revenue", () => {
    // 1M tokens/day × $1 = $1M emission vs $50K fees → ratio 20×
    const snap = { ...healthySnap, daily_emission_tokens: 1_000_000, daily_fee_revenue_usd: 50_000 };
    const result = detectDeathSpiral(snap);
    expect(result.triggers).toContain("EMISSIONS_UNSUSTAINABLE");
  });

  it("flags LIQUIDITY_CRITICAL when LP TVL < 2% of market cap", () => {
    // Market cap = $1 × 100M = $100M. LP = $1.5M = 1.5% → critical
    const snap = { ...healthySnap, lp_tvl_usd: 1_500_000 };
    const result = detectDeathSpiral(snap);
    expect(result.triggers).toContain("LIQUIDITY_CRITICAL");
  });

  it("returns SPIRAL for combined heavy sell + unsustainable emissions + thin liquidity", () => {
    const worstCase: TokenomicsSnapshot = {
      price_usd: 0.10,
      circulating_supply: 100_000_000,
      daily_emission_tokens: 2_000_000,  // $200K/day emission
      daily_fee_revenue_usd: 5_000,       // only $5K fees → 40× ratio
      lp_tvl_usd: 100_000,               // 1% of market cap
      holder_count: 300,
      buy_sell_ratio_7d: 0.3,
    };
    const result = detectDeathSpiral(worstCase);
    expect(result.risk).toBe("SPIRAL");
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.triggers.length).toBeGreaterThanOrEqual(3);
  });

  it("recommended_action mentions counter-playbook for SPIRAL", () => {
    const worstCase: TokenomicsSnapshot = {
      price_usd: 0.10, circulating_supply: 100_000_000,
      daily_emission_tokens: 2_000_000, daily_fee_revenue_usd: 5_000,
      lp_tvl_usd: 100_000, holder_count: 300, buy_sell_ratio_7d: 0.3,
    };
    const result = detectDeathSpiral(worstCase);
    expect(result.recommended_action).toMatch(/counter-playbook/i);
  });

  it("score is bounded 0-100", () => {
    const result = detectDeathSpiral(healthySnap);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("handles zero fee revenue without dividing by zero", () => {
    const snap = { ...healthySnap, daily_fee_revenue_usd: 0 };
    expect(() => detectDeathSpiral(snap)).not.toThrow();
  });
});
