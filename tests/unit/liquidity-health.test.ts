/**
 * Unit tests — Liquidity Health
 * Framework: Vitest
 * Run: npx vitest run tests/unit/liquidity-health.test.ts
 */

import { describe, it, expect } from "vitest";
import { computeLPHealth } from "./liquidity-health";

// ── Tests ────────────────────────────────────────────────────────────────────
describe("computeLPHealth", () => {
  const POOL = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";

  it("healthy position — high % in range, tight spread → no alert", () => {
    const r = computeLPHealth(POOL, 1.00, 8000n, 10000n, 20);
    expect(r.inRangePct).toBe(80);
    expect(r.isOutOfRange).toBe(false);
    expect(r.alert).toBeNull();
  });

  it("OUT_OF_RANGE when <10% in range", () => {
    const r = computeLPHealth(POOL, 1.00, 500n, 10000n, 20);
    expect(r.inRangePct).toBe(5);
    expect(r.isOutOfRange).toBe(true);
    expect(r.alert).toMatch(/OUT OF RANGE/);
    expect(r.alert).toMatch(/Rebalance now/);
  });

  it("DRIFTING alert when 10%-30% in range", () => {
    const r = computeLPHealth(POOL, 1.00, 2000n, 10000n, 20);
    expect(r.inRangePct).toBe(20);
    expect(r.isOutOfRange).toBe(false);
    expect(r.alert).toMatch(/drifting/);
    expect(r.alert).toMatch(/24h/);
  });

  it("SPREAD alert when >100 bps and position healthy", () => {
    const r = computeLPHealth(POOL, 1.00, 9000n, 10000n, 150);
    expect(r.alert).toMatch(/Spread at 150bps/);
  });

  it("OUT_OF_RANGE takes priority over spread alert", () => {
    // Even if spread is high, the primary alert should be about being out of range
    const r = computeLPHealth(POOL, 1.00, 500n, 10000n, 200);
    expect(r.alert).toMatch(/OUT OF RANGE/);
    expect(r.alert).not.toMatch(/Spread/);
  });

  it("handles zero total liquidity without division error", () => {
    expect(() => computeLPHealth(POOL, 1.00, 0n, 0n, 20)).not.toThrow();
    const r = computeLPHealth(POOL, 1.00, 0n, 0n, 20);
    expect(r.inRangePct).toBe(0);
    expect(r.isOutOfRange).toBe(true);
  });

  it("inRangePct is exactly 100 when all liquidity in range", () => {
    const r = computeLPHealth(POOL, 1.00, 5000n, 5000n, 20);
    expect(r.inRangePct).toBe(100);
  });

  it("inRangePct precision — 1/3 is approximately 33.33", () => {
    const r = computeLPHealth(POOL, 1.00, 1n, 3n, 20);
    expect(r.inRangePct).toBeCloseTo(33.33, 1);
  });

  it("exposes raw bigint liquidity values unchanged", () => {
    const r = computeLPHealth(POOL, 1.00, 7777n, 9999n, 20);
    expect(r.liquidityInRange).toBe(7777n);
    expect(r.liquidityTotal).toBe(9999n);
  });
});
