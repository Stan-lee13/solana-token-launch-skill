/**
 * Reference implementation — Sell Pressure Analyzer
 * See tests/unit/sell-pressure-analyzer.test.ts
 */

// ── Types ────────────────────────────────────────────────────────────────────
export type Verdict = "HEALTHY" | "WATCH" | "HEAVY_DISTRIBUTION" | "COORDINATED_EXIT";

export interface SellerData {
  wallet: string;
  amountUsd: number;
  txCount: number;
  timestamps: number[];
}

export interface SellPressureResult {
  netFlowUsd: number;
  buyVsSellRatio: number;
  largeSellerCount: number;
  isOrganized: boolean;
  topSellers: SellerData[];
  verdict: Verdict;
}

// ── Pure logic under test (extracted from analyzeSellPressure) ───────────────
export function computeVerdict(
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
