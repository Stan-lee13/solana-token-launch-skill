/**
 * Reference implementation — Liquidity Health
 * See skill/post-launch-monitoring.md and tests/unit/liquidity-health.test.ts
 */

// ── Types from post-launch-monitoring.md ─────────────────────────────────────
export interface LPHealthReport {
  poolAddress: string;
  activeBinPrice: number;
  liquidityInRange: bigint;
  liquidityTotal: bigint;
  inRangePct: number;
  spreadBps: number;
  dailyFeesEarned: number;
  isOutOfRange: boolean;
  alert: string | null;
}

// ── Pure logic under test ─────────────────────────────────────────────────────
// Named constants (matches post-launch-monitoring.md)
const IN_RANGE_BPS_THRESHOLD = 10;
const SPREAD_WARN_BPS = 100;
const LP_DRIFTING_THRESHOLD = 30;

export function computeLPHealth(
  poolAddress: string,
  activeBinPrice: number,
  liquidityInRange: bigint,
  liquidityTotal: bigint,
  spreadBps: number,
  dailyFeesEarned: number = 0
): LPHealthReport {
  const inRangePct = liquidityTotal > 0n
    ? Number(liquidityInRange * 10000n / liquidityTotal) / 100
    : 0;

  const isOutOfRange = inRangePct < IN_RANGE_BPS_THRESHOLD;

  let alert: string | null = null;
  if (isOutOfRange) {
    alert = `⚠️ LP position is OUT OF RANGE — only ${inRangePct.toFixed(1)}% earning fees. Rebalance now.`;
  } else if (inRangePct < LP_DRIFTING_THRESHOLD) {
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
    dailyFeesEarned,
    isOutOfRange,
    alert,
  };
}
