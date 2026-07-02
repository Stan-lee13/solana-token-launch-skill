/**
 * Reference implementation — Death Spiral Detector
 * See skill/tokenomics-design.md and tests/unit/death-spiral-detector.test.ts
 */

// ── Types mirrored from skill/tokenomics-design.md ─────────────────────────
export interface TokenomicsSnapshot {
  price_usd: number;
  circulating_supply: number;
  daily_emission_tokens: number;
  daily_fee_revenue_usd: number;
  lp_tvl_usd: number;
  holder_count: number;
  buy_sell_ratio_7d: number;
}

export type SpiralRisk = "SAFE" | "WATCH" | "WARNING" | "SPIRAL";

export interface SpiralAnalysis {
  risk: SpiralRisk;
  score: number;          // 0-100 (higher = more dangerous)
  triggers: string[];
  recommended_action: string;
}

// ── Function under test ─────────────────────────────────────────────────────
export function detectDeathSpiral(snap: TokenomicsSnapshot): SpiralAnalysis {
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
