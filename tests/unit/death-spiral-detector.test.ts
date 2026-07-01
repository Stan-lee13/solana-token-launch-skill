/**
 * Unit tests — Death Spiral Detector
 * Framework: Vitest (drop-in Jest compatible)
 * Run: npx vitest run tests/unit/death-spiral-detector.test.ts
 */

import { describe, it, expect } from "vitest";

// ── Types mirrored from skill/tokenomics-design.md ─────────────────────────
interface TokenomicsSnapshot {
  price_usd: number;
  circulating_supply: number;
  daily_emission_tokens: number;
  daily_fee_revenue_usd: number;
  lp_tvl_usd: number;
  holder_count: number;
  buy_sell_ratio_7d: number;
}

type SpiralRisk = "SAFE" | "WATCH" | "WARNING" | "SPIRAL";

interface SpiralAnalysis {
  risk: SpiralRisk;
  score: number;          // 0-100 (higher = more dangerous)
  triggers: string[];
  recommended_action: string;
}

// ── Function under test (inline — would import from src/ in real project) ──
function detectDeathSpiral(snap: TokenomicsSnapshot): SpiralAnalysis {
  const triggers: string[] = [];
  let score = 0;

  // Sell pressure
  if (snap.buy_sell_ratio_7d < 0.5) { triggers.push("HEAVY_SELL_PRESSURE"); score += 30; }
  else if (snap.buy_sell_ratio_7d < 0.7) { triggers.push("ELEVATED_SELL_PRESSURE"); score += 15; }

  // Emission vs fee sink
  const daily_emission_usd = snap.daily_emission_tokens * snap.price_usd;
  if (daily_emission_usd > snap.daily_fee_revenue_usd * 10) { triggers.push("EMISSIONS_UNSUSTAINABLE"); score += 25; }
  else if (daily_emission_usd > snap.daily_fee_revenue_usd * 5) { triggers.push("EMISSIONS_HIGH"); score += 10; }

  // Liquidity thinning
  const lp_ratio = snap.lp_tvl_usd / (snap.price_usd * snap.circulating_supply);
  if (lp_ratio < 0.02) { triggers.push("LIQUIDITY_CRITICAL"); score += 25; }
  else if (lp_ratio < 0.05) { triggers.push("LIQUIDITY_LOW"); score += 10; }

  // Holder decline signal (supply growing faster than holders)
  if (snap.holder_count < 500) { triggers.push("LOW_HOLDER_COUNT"); score += 10; }

  const risk: SpiralRisk =
    score >= 70 ? "SPIRAL" :
    score >= 45 ? "WARNING" :
    score >= 20 ? "WATCH" :
    "SAFE";

  const recommended_action =
    risk === "SPIRAL"  ? "EMERGENCY: Execute counter-playbook immediately. Load post-launch-monitoring.md → Week 2 Death section." :
    risk === "WARNING" ? "Announce staking program, accelerate product milestone, prepare visible buyback." :
    risk === "WATCH"   ? "Monitor daily. Pre-stage staking announcement. Do not ignore." :
    "Healthy. Review weekly.";

  return { risk, score, triggers, recommended_action };
}

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
