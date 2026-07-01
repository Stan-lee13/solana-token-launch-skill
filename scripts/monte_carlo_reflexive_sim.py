#!/usr/bin/env python3
"""
monte_carlo_reflexive_sim.py — Agent-based Monte Carlo TGE reflexivity simulator.

WHY THIS EXISTS
---------------
simulate_tokenomics.py answers "what does the emission/burn ledger look like."
It is a deterministic accounting model — same inputs always produce the same
single trajectory. It cannot answer the question that actually kills tokens:
"what is the PROBABILITY this launch survives week two, and which lever moves
that probability the most?"

Real token markets are reflexive: price movement changes holder behavior, which
changes price. A farmer who is up 5x behaves completely differently from one
who is down 40%. A single deterministic ledger cannot capture that feedback
loop — you need a population of heterogeneous agents, each with BEHAVIOR THAT
IS ITSELF UNCERTAIN, run many times under randomness, to get a real probability
distribution instead of one point estimate.

MODEL
-----
Five holder archetypes, each with a distinct sell-propensity function of
unrealized P&L and days-since-unlock. Propensities are drawn per-TRIAL from
distributions (not fixed constants) — that per-trial behavioral randomness,
not just price noise, is what makes the output bands meaningful instead of
collapsing to a single deterministic path with cosmetic jitter.

  FARMER       — airdrop recipient, near-zero cost basis. Dumps hard for the
                 first few days regardless of price (any price is a "win").
  FLIPPER      — momentum trader. Sell propensity RISES as price falls (panic)
                 and also rises on strong pumps (take profit). U-shaped curve.
  BELIEVER     — long-term holder. Sell propensity stays low unless price
                 crashes past a capitulation threshold.
  MARKET_MAKER — provides two-sided liquidity; held out of the directional
                 sell pool entirely (it exists to dampen moves, not cause them).
  VESTING      — team/investor unlocks. Deterministic per the vesting
                 schedule — modeled as a scheduled supply injection, not a
                 price-reactive agent.

PRICE IMPACT: modeled as a real constant-product AMM swap against pool
reserves (x*y=k), NOT a linear "flow / liquidity" scalar. Linear models are
unbounded and can imply >100% price drops in one day, which is not how AMMs
work — constant-product impact saturates asymptotically instead.

Run thousands of trials with randomized per-trial behavioral parameters to
get P10/P50/P90 price bands and a death-spiral probability, instead of one path.

Usage:
    python3 scripts/monte_carlo_reflexive_sim.py                     # 2000 trials, 30 days
    python3 scripts/monte_carlo_reflexive_sim.py --trials 5000 --days 45
    python3 scripts/monte_carlo_reflexive_sim.py --farmer-pct 0.55    # stress a specific config
    python3 scripts/monte_carlo_reflexive_sim.py --liquidity-usd 2000000
    python3 scripts/monte_carlo_reflexive_sim.py --json

Requires: numpy (see requirements.txt — this is the one consumer of it besides
matplotlib charting; simulate_tokenomics.py itself stays stdlib-only by design).
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from typing import Optional

try:
    import numpy as np
except ImportError:
    print(
        "error: this script requires numpy (pip install -r requirements.txt).\n"
        "simulate_tokenomics.py remains stdlib-only if you need a numpy-free path.",
        file=sys.stderr,
    )
    sys.exit(1)


DEATH_SPIRAL_DRAWDOWN_PCT = 70.0  # matches death-spiral-detector.md SPIRAL threshold philosophy
AMM_FEE_BPS = 30  # 0.30%, standard constant-product fee tier


@dataclass
class LaunchConfig:
    total_supply: float = 1_000_000_000
    initial_price_usd: float = 1.0
    initial_circulating: float = 150_000_000     # tokens live (outside the pool) at T+0

    # Liquidity depth as a PERCENTAGE OF CIRCULATING MARKET CAP — this is the
    # scale-invariant lever real teams actually control, unlike a raw dollar figure
    # that can silently mismatch whatever circulating supply/price you chose.
    # 3-5% is typical/risky for memecoin-style launches; 10%+ is well-capitalized.
    liquidity_pct_of_mcap: float = 0.05

    # Holder composition of circulating supply (must sum to 1.0)
    farmer_pct: float = 0.35
    flipper_pct: float = 0.36
    believer_pct: float = 0.23
    market_maker_pct: float = 0.06

    # Vesting supply injection (team+investor), simplified linear post-cliff
    vesting_cliff_days: int = 9999   # default: no unlock inside the sim window
    vesting_daily_tokens: float = 0.0

    # Organic demand as a fraction of circulating market cap PER DAY (scale-invariant,
    # same reasoning as liquidity_pct_of_mcap above). Calibrated so that in a CALM
    # market (no farmer dumping, no panic) baseline demand roughly matches baseline
    # non-panic churn from flippers/believers — otherwise the system bleeds out by
    # construction even at zero farmer allocation, which makes the tool unable to
    # ever show a healthy launch and therefore useless for differentiating risk.
    daily_organic_demand_pct_of_mcap: float = 0.016

    seed: Optional[int] = None

    @property
    def circulating_mcap_usd(self) -> float:
        return self.initial_circulating * self.initial_price_usd

    @property
    def initial_liquidity_usd(self) -> float:
        return self.circulating_mcap_usd * self.liquidity_pct_of_mcap

    @property
    def daily_organic_demand_usd(self) -> float:
        return self.circulating_mcap_usd * self.daily_organic_demand_pct_of_mcap


class AmmPool:
    """Minimal constant-product AMM (x*y=k) with a swap fee — bounded price impact by construction."""

    def __init__(self, usd_reserve: float, price: float):
        self.usd_reserve = usd_reserve
        self.token_reserve = usd_reserve / price

    @property
    def price(self) -> float:
        return self.usd_reserve / self.token_reserve

    def sell_tokens(self, tokens_in: float) -> float:
        """Sell `tokens_in` tokens into the pool. Returns USD received. Price drops (saturating)."""
        if tokens_in <= 0:
            return 0.0
        tokens_in_after_fee = tokens_in * (1 - AMM_FEE_BPS / 10_000)
        usd_out = self.usd_reserve * tokens_in_after_fee / (self.token_reserve + tokens_in_after_fee)
        usd_out = min(usd_out, self.usd_reserve * 0.995)  # can never fully drain the pool
        self.token_reserve += tokens_in
        self.usd_reserve -= usd_out
        return usd_out

    def buy_tokens(self, usd_in: float) -> float:
        """Spend `usd_in` USD buying tokens from the pool. Returns tokens received. Price rises."""
        if usd_in <= 0:
            return 0.0
        usd_in_after_fee = usd_in * (1 - AMM_FEE_BPS / 10_000)
        tokens_out = self.token_reserve * usd_in_after_fee / (self.usd_reserve + usd_in_after_fee)
        tokens_out = min(tokens_out, self.token_reserve * 0.995)
        self.usd_reserve += usd_in
        self.token_reserve -= tokens_out
        return tokens_out


@dataclass
class TrialResult:
    price_path: list
    max_drawdown_pct: float
    death_spiral_day: Optional[int]


def _sell_propensity_farmer(day: int, dump_intensity: float) -> float:
    # Even the most eager airdrop farmers unwind over ~1-2 weeks (tx costs, time zones,
    # exchange withdrawal batching, some hesitation) — not in one instantaneous dump.
    base = dump_intensity if day <= 5 else max(dump_intensity - (day - 5) * 0.025, 0.04)
    return min(base, 0.35)


def _sell_propensity_flipper(pnl_pct: float, panic_sensitivity: float) -> float:
    if pnl_pct < -30:
        return min(0.06 + (abs(pnl_pct) - 30) * panic_sensitivity, 0.30)
    if pnl_pct > 50:
        return min(0.08 + (pnl_pct - 50) * 0.0015, 0.22)
    return 0.04


def _sell_propensity_believer(pnl_pct: float, capitulation_threshold: float) -> float:
    if pnl_pct < capitulation_threshold:
        return 0.12
    return 0.015


def run_single_trial(config: LaunchConfig, days: int, rng: "np.random.Generator") -> TrialResult:
    launch_price = config.initial_price_usd
    pool = AmmPool(config.initial_liquidity_usd, launch_price)

    circ = config.initial_circulating
    farmer_tokens = circ * config.farmer_pct
    flipper_tokens = circ * config.flipper_pct
    believer_tokens = circ * config.believer_pct

    # ── Per-TRIAL behavioral randomness (this is what makes Monte Carlo meaningful) ──
    # Different launches attract different farmer conviction, different flipper panic
    # sensitivity, different organic-demand strength — draw them once per trial.
    dump_intensity = float(np.clip(rng.normal(0.22, 0.06), 0.08, 0.35))
    panic_sensitivity = float(np.clip(rng.normal(0.006, 0.002), 0.002, 0.012))
    capitulation_threshold = float(np.clip(rng.normal(-65, 10), -90, -40))
    demand_multiplier = float(np.clip(rng.lognormal(mean=0.0, sigma=0.45), 0.15, 4.0))

    price_path = [launch_price]
    max_drawdown = 0.0
    death_spiral_day: Optional[int] = None

    for day in range(1, days + 1):
        current_price = pool.price
        pnl_pct = (current_price / launch_price - 1) * 100

        if day > config.vesting_cliff_days:
            farmer_tokens += config.vesting_daily_tokens

        sell_farmer = farmer_tokens * _sell_propensity_farmer(day, dump_intensity)
        sell_flipper = flipper_tokens * _sell_propensity_flipper(pnl_pct, panic_sensitivity)
        sell_believer = believer_tokens * _sell_propensity_believer(pnl_pct, capitulation_threshold)
        total_sell_tokens = sell_farmer + sell_flipper + sell_believer

        # Daily organic demand: baseline x per-trial multiplier x daily noise x REFLEXIVE
        # confidence factor. A chart that has crashed scares away buyers (real dynamic);
        # a recovering chart attracts them. Without this, a maximally-drained pool keeps
        # absorbing full-strength buying with no sellers left, producing an economically
        # absurd "crash 99% then moon 5x" artifact purely from AMM math in isolation.
        # Asymmetric by design: a crash suppresses buyer confidence (real effect), but a
        # rally should NOT create bonus demand beyond baseline within this simplified model —
        # letting it do so is what produced implausible moonshot artifacts in earlier passes.
        confidence = float(np.clip(pnl_pct / 100 + 1.0, 0.20, 1.0))
        daily_noise = float(np.clip(rng.normal(1.0, 0.25), 0.1, 3.0))
        buy_usd = config.daily_organic_demand_usd * demand_multiplier * daily_noise * confidence

        # Execute against the SAME pool as sequential swaps (order doesn't matter much at
        # daily granularity, but do sells first — sell pressure typically leads in a dump day)
        price_before = pool.price
        if total_sell_tokens > 0:
            pool.sell_tokens(total_sell_tokens)
        if buy_usd > 0:
            pool.buy_tokens(buy_usd)

        # Daily price-change cap: real markets correct extreme single-day AMM
        # dislocations fast via cross-venue (CEX/other-DEX) arbitrage. Without this,
        # a badly-imbalanced pool (post-dump) lets ordinary follow-on buying move
        # price by an enormous PERCENTAGE against the now-tiny base — a genuine AMM
        # edge case, not a real market outcome. Cap at +/-35%/day, then resync the
        # pool's reserves to match the capped price so the invariant stays consistent.
        raw_price = pool.price
        max_price = price_before * 1.12
        min_price = price_before * 0.80
        capped_price = min(max(raw_price, min_price), max_price)
        if capped_price != raw_price:
            k = pool.usd_reserve * pool.token_reserve
            pool.token_reserve = (k / capped_price) ** 0.5
            pool.usd_reserve = pool.token_reserve * capped_price

        new_price = pool.price
        price_path.append(new_price)
        drawdown = (1 - new_price / launch_price) * 100
        max_drawdown = max(max_drawdown, drawdown)
        if drawdown >= DEATH_SPIRAL_DRAWDOWN_PCT and death_spiral_day is None:
            death_spiral_day = day

        farmer_tokens = max(farmer_tokens - sell_farmer, 0)
        # ~15% of flipper sell volume recycles back in as new flipper buyers next day —
        # most panic-sellers don't rebuy the same week; the population should deplete,
        # not sustain itself indefinitely across the full window.
        flipper_tokens = max(flipper_tokens - sell_flipper, 0) + sell_flipper * 0.15
        believer_tokens = max(believer_tokens - sell_believer, 0)

    return TrialResult(price_path=price_path, max_drawdown_pct=max_drawdown, death_spiral_day=death_spiral_day)


def run_monte_carlo(config: LaunchConfig, trials: int, days: int) -> dict:
    rng = np.random.default_rng(config.seed)
    results = [run_single_trial(config, days, rng) for _ in range(trials)]

    final_prices_pct = np.array([r.price_path[-1] / config.initial_price_usd * 100 for r in results])
    max_drawdowns = np.array([r.max_drawdown_pct for r in results])
    death_spirals = sum(1 for r in results if r.death_spiral_day is not None)

    all_paths = np.array([r.price_path for r in results])  # (trials, days+1)
    p10 = np.percentile(all_paths, 10, axis=0)
    p50 = np.percentile(all_paths, 50, axis=0)
    p90 = np.percentile(all_paths, 90, axis=0)

    return {
        "trials": trials,
        "days": days,
        "death_spiral_probability_pct": round(death_spirals / trials * 100, 2),
        "median_final_price_pct_of_launch": round(float(np.median(final_prices_pct)), 2),
        "p10_final_price_pct_of_launch": round(float(np.percentile(final_prices_pct, 10)), 2),
        "p90_final_price_pct_of_launch": round(float(np.percentile(final_prices_pct, 90)), 2),
        "median_max_drawdown_pct": round(float(np.median(max_drawdowns)), 2),
        "worst_decile_max_drawdown_pct": round(float(np.percentile(max_drawdowns, 90)), 2),
        "price_band_p10": [round(float(x), 4) for x in p10],
        "price_band_p50": [round(float(x), 4) for x in p50],
        "price_band_p90": [round(float(x), 4) for x in p90],
    }


def print_report(summary: dict, config: LaunchConfig) -> None:
    print(f"Monte Carlo TGE Reflexivity Simulation — {summary['trials']} trials x {summary['days']} days")
    print(f"Composition: farmers={config.farmer_pct:.0%} flippers={config.flipper_pct:.0%} "
          f"believers={config.believer_pct:.0%} MM={config.market_maker_pct:.0%}  "
          f"| Initial liquidity: ${config.initial_liquidity_usd:,.0f}\n")

    p = summary["death_spiral_probability_pct"]
    verdict = "HIGH RISK" if p > 40 else ("ELEVATED RISK" if p > 15 else "LOWER RISK")
    print(f"Death-spiral probability (>{DEATH_SPIRAL_DRAWDOWN_PCT:.0f}% drawdown): {p}%  [{verdict}]")
    print(f"Median final price: {summary['median_final_price_pct_of_launch']}% of launch "
          f"(P10={summary['p10_final_price_pct_of_launch']}%, P90={summary['p90_final_price_pct_of_launch']}%)")
    print(f"Median max drawdown: {summary['median_max_drawdown_pct']}%  "
          f"(worst decile: {summary['worst_decile_max_drawdown_pct']}%)")
    print()
    print("Day |  P10 price |  P50 price |  P90 price")
    stride = max(summary["days"] // 15, 1)
    for day in range(0, summary["days"] + 1, stride):
        print(f"{day:>3} | {summary['price_band_p10'][day]:>10.4f} | "
              f"{summary['price_band_p50'][day]:>10.4f} | {summary['price_band_p90'][day]:>10.4f}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Monte Carlo agent-based TGE reflexivity simulator")
    parser.add_argument("--trials", type=int, default=2000)
    parser.add_argument("--days", type=int, default=30)
    parser.add_argument("--farmer-pct", type=float, default=0.35)
    parser.add_argument("--liquidity-pct", type=float, default=0.05, help="Liquidity depth as a fraction of circulating market cap (0.03-0.05=risky, 0.10+=well-capitalized)")
    parser.add_argument("--team-pct", type=float, default=None, help="Models a linear vesting supply shock from team unlocks starting day 1")
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    if not (0 <= args.farmer_pct <= 1):
        print("error: --farmer-pct must be between 0 and 1", file=sys.stderr)
        return 1
    if not (0 < args.liquidity_pct <= 1):
        print("error: --liquidity-pct must be between 0 and 1", file=sys.stderr)
        return 1

    config = LaunchConfig(farmer_pct=args.farmer_pct, liquidity_pct_of_mcap=args.liquidity_pct, seed=args.seed)
    remainder = 1.0 - config.farmer_pct
    config.flipper_pct = remainder * 0.45
    config.believer_pct = remainder * 0.45
    config.market_maker_pct = remainder * 0.10

    if args.team_pct is not None:
        config.vesting_cliff_days = 0
        config.vesting_daily_tokens = (config.initial_circulating / (1 - args.team_pct) * args.team_pct) / 365

    summary = run_monte_carlo(config, trials=args.trials, days=args.days)

    if args.json:
        print(json.dumps(summary, indent=2))
    else:
        print_report(summary, config)

    return 0


if __name__ == "__main__":
    sys.exit(main())
