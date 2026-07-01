#!/usr/bin/env python3
"""
simulate_tokenomics.py — Token emission / vesting / buyback-burn simulator.

Mirrors the TypeScript reference implementation in
tests/regression/tokenomics-simulation.test.ts — the two MUST stay in sync.
If you change the model here, update the TS mirror (and vice versa), or the
regression test suite will silently drift from the real simulation.

Usage:
    python3 scripts/simulate_tokenomics.py                  # 36-month run, table output
    python3 scripts/simulate_tokenomics.py --months 60       # custom horizon
    python3 scripts/simulate_tokenomics.py --json             # machine-readable output
    python3 scripts/simulate_tokenomics.py --chart out.png    # requires matplotlib

Core simulation uses stdlib only (see requirements.txt) — chart output is the
only optional extra. mypy-clean (see CI `python` job).
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, asdict
from typing import List


@dataclass
class SimConfig:
    total_supply: float = 1_000_000_000
    team_pct: float = 0.15
    investors_pct: float = 0.10
    community_pct: float = 0.40
    treasury_pct: float = 0.20
    liquidity_pct: float = 0.15
    team_cliff_months: int = 12
    team_vest_months: int = 36
    investor_cliff_months: int = 6
    investor_vest_months: int = 24
    monthly_emission_pct: float = 0.005
    monthly_protocol_revenue_usd: float = 500_000
    token_price_usd: float = 1.0
    fee_buyback_pct: float = 0.50
    monthly_organic_demand_tokens: float = 2_000_000

    def __post_init__(self) -> None:
        allocation_total = round(
            self.team_pct
            + self.investors_pct
            + self.community_pct
            + self.treasury_pct
            + self.liquidity_pct,
            6,
        )
        if allocation_total != 1.0:
            raise ValueError(
                f"Token allocations must sum to 100%, got {allocation_total * 100:.2f}% "
                f"(team={self.team_pct}, investors={self.investors_pct}, "
                f"community={self.community_pct}, treasury={self.treasury_pct}, "
                f"liquidity={self.liquidity_pct})"
            )
        if self.token_price_usd <= 0:
            raise ValueError("token_price_usd must be > 0")
        if any(v < 0 for v in (self.team_vest_months, self.investor_vest_months)):
            raise ValueError("vest_months must be >= 0")


@dataclass
class MonthResult:
    month: int
    circulating_supply: int
    cumulative_burned: int
    net_monthly_emission: int
    sell_pressure_usd: int
    demand_usd: int
    implied_price: float


def simulate(config: SimConfig, months: int = 36) -> List[MonthResult]:
    """Month-by-month emission/vesting/buyback-burn simulation.

    Mirrors tests/regression/tokenomics-simulation.test.ts::simulate() exactly,
    including the (>, not >=) cliff-exclusive vesting semantics.
    """
    results: List[MonthResult] = []
    circulating = config.total_supply * config.liquidity_pct
    burned = 0.0

    for month in range(1, months + 1):
        if month > config.team_cliff_months:
            circulating += (config.total_supply * config.team_pct) / config.team_vest_months
        if month > config.investor_cliff_months:
            circulating += (config.total_supply * config.investors_pct) / config.investor_vest_months

        emission = config.total_supply * config.monthly_emission_pct
        circulating += emission

        usd_for_buyback = config.monthly_protocol_revenue_usd * config.fee_buyback_pct
        tokens_burned = usd_for_buyback / config.token_price_usd
        circulating -= tokens_burned
        burned += tokens_burned

        net_monthly_emission = emission - tokens_burned
        sell_pressure_usd = net_monthly_emission * config.token_price_usd
        demand_usd = config.monthly_organic_demand_tokens * config.token_price_usd + usd_for_buyback

        results.append(
            MonthResult(
                month=month,
                circulating_supply=round(circulating),
                cumulative_burned=round(burned),
                net_monthly_emission=round(net_monthly_emission),
                sell_pressure_usd=round(sell_pressure_usd),
                demand_usd=round(demand_usd),
                implied_price=config.token_price_usd,  # simplified — real sim adjusts dynamically
            )
        )

    return results


def print_table(results: List[MonthResult]) -> None:
    header = f"{'Month':>5} | {'Circulating':>15} | {'Burned (cum)':>13} | {'Net Emission':>13} | {'Sell $':>12} | {'Demand $':>12}"
    print(header)
    print("-" * len(header))
    # Print every month for horizons <= 12, else every 3rd month to keep output readable
    stride = 1 if len(results) <= 12 else 3
    for r in results:
        if r.month % stride == 0 or r.month == len(results):
            print(
                f"{r.month:>5} | {r.circulating_supply:>15,} | {r.cumulative_burned:>13,} | "
                f"{r.net_monthly_emission:>13,} | {r.sell_pressure_usd:>12,.0f} | {r.demand_usd:>12,.0f}"
            )


def maybe_chart(results: List[MonthResult], out_path: str) -> None:
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        print(
            "⚠️  --chart requires matplotlib (pip install -r requirements.txt). Skipping chart.",
            file=sys.stderr,
        )
        return

    months = [r.month for r in results]
    circulating = [r.circulating_supply for r in results]
    burned = [r.cumulative_burned for r in results]

    fig, ax1 = plt.subplots(figsize=(10, 6))
    ax1.plot(months, circulating, label="Circulating supply", color="#F59E0B")
    ax1.plot(months, burned, label="Cumulative burned", color="#EF4444", linestyle="--")
    ax1.set_xlabel("Month")
    ax1.set_ylabel("Tokens")
    ax1.set_title("Token Emission vs Buyback-Burn Simulation")
    ax1.legend()
    ax1.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(out_path, dpi=150)
    print(f"📈 Chart saved to {out_path}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Token launch tokenomics simulator")
    parser.add_argument("--months", type=int, default=36, help="Simulation horizon in months (default: 36)")
    parser.add_argument("--json", action="store_true", help="Output JSON instead of a table")
    parser.add_argument("--chart", metavar="PATH", help="Save a PNG chart to PATH (requires matplotlib)")
    args = parser.parse_args()

    if args.months < 1:
        print("error: --months must be >= 1", file=sys.stderr)
        return 1

    config = SimConfig()

    try:
        results = simulate(config, months=args.months)
    except ValueError as e:
        print(f"error: invalid config — {e}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps([asdict(r) for r in results], indent=2))
    else:
        print(f"Tokenomics simulation — {args.months} months — total supply {config.total_supply:,.0f}\n")
        print_table(results)
        final = results[-1]
        print(f"\nFinal circulating supply: {final.circulating_supply:,} ({final.circulating_supply / config.total_supply * 100:.1f}% of total)")
        print(f"Total burned: {final.cumulative_burned:,} tokens")

    if args.chart:
        maybe_chart(results, args.chart)

    return 0


if __name__ == "__main__":
    sys.exit(main())
