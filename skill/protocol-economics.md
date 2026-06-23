# Protocol Economics — Fee Modeling, Emission Simulation & Incentive Design

The gap between a protocol that survives and one that collapses is almost always economic,
not technical. This skill covers what no other tool builds: simulating your protocol's
economy before it goes live.

**Problems this solves:**
- "We didn't realize the inflation would outpace fee revenue until month 3"
- "Our staking rewards were too high — attracted mercenary capital that dumped immediately"  
- "We had no token sinks — every emission ended up as sell pressure"
- "Our vesting schedule created a predictable dump every quarter"

---

## The Three Economic Failure Patterns

### 1. Emissions Without Sinks (Inflationary Death Spiral)
Tokens are emitted (staking rewards, LM rewards, airdrops) but there is no structural reason to hold them. Every emission = sell pressure. Price falls. APY denominated in token terms stays stable but USD APY collapses. TVL leaves. Fewer fees. Less burn. More tokens, less value.

### 2. Mercenary Capital Trap
High initial APY attracts LPs and stakers who have no long-term interest in the protocol. When APY normalizes, they withdraw all liquidity simultaneously. Protocol loses 80% of TVL in one week.

### 3. Vesting Cliff Shock
Team and investor tokens unlock in large batches. Even if founders don't sell, market anticipates the unlock and front-runs it. Price drops before the cliff. Token never recovers to pre-unlock levels.

---

## Token Sink Design Patterns

Every emission must have at least one sink. Design these before launch.

```
WEAK SINKS (users can opt out immediately):
  - "Stake to earn more tokens" — circular, just concentrates inflation
  - "Hold for governance" — only works if governance controls real cash flows
  - "Burn 1% on each transfer" — too small to matter at scale

STRONG SINKS (structural, hard to exit):
  ✅ Protocol fees paid in token (buy-and-burn from fee revenue)
  ✅ Token required as collateral to access premium features
  ✅ Staking lock with slashing (capital at risk = real commitment)
  ✅ Protocol-owned liquidity (treasury holds LP positions — token never enters sell pool)
  ✅ Token required to vote on fee splits that affect staker revenue
  ✅ Burn triggered by specific protocol events (liquidations, settlements)
```

### Implementing Buy-and-Burn from Fee Revenue

```typescript
// programs/my_protocol/src/instructions/process_fees.rs (Anchor)
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Token, TokenAccount, Mint};

#[derive(Accounts)]
pub struct ProcessProtocolFees<'info> {
    #[account(mut)]
    pub fee_vault: Account<'info, TokenAccount>,          // Protocol fee accumulator
    
    #[account(mut)]
    pub token_mint: Account<'info, Mint>,                 // Your protocol token
    
    #[account(mut)]
    pub buyback_wallet: Account<'info, TokenAccount>,     // Holds purchased tokens pre-burn
    
    pub token_program: Program<'info, Token>,
    
    /// CHECK: Jupiter CPI for fee token → protocol token swap
    pub jupiter_program: UncheckedAccount<'info>,
}

pub fn process_protocol_fees(ctx: Context<ProcessProtocolFees>) -> Result<()> {
    let fee_vault = &ctx.accounts.fee_vault;
    
    // Only execute buyback if enough fees have accumulated (avoid gas waste on micro-burns)
    let MINIMUM_BUYBACK_THRESHOLD: u64 = 1_000_000_000; // 1,000 USDC equivalent
    require!(
        fee_vault.amount >= MINIMUM_BUYBACK_THRESHOLD,
        ProtocolError::InsufficientFeesForBuyback
    );
    
    // 1. Swap fee token → protocol token via Jupiter CPI
    // [Jupiter CPI code here — see listing-strategy.md for Jupiter integration]
    
    // 2. Burn the purchased protocol tokens
    let cpi_accounts = Burn {
        mint: ctx.accounts.token_mint.to_account_info(),
        from: ctx.accounts.buyback_wallet.to_account_info(),
        authority: ctx.accounts.buyback_wallet.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
    
    let amount_to_burn = ctx.accounts.buyback_wallet.amount;
    token::burn(cpi_ctx, amount_to_burn)?;
    
    emit!(BuybackExecuted {
        fee_amount_used: fee_vault.amount,
        tokens_burned: amount_to_burn,
        timestamp: Clock::get()?.unix_timestamp,
    });
    
    Ok(())
}

#[event]
pub struct BuybackExecuted {
    pub fee_amount_used: u64,
    pub tokens_burned: u64,
    pub timestamp: i64,
}
```

---

## Emission Schedule Simulation

Before setting emission rates, simulate 3 years of your protocol economics.

```python
#!/usr/bin/env python3
# scripts/simulate_tokenomics.py
# Run: python3 simulate_tokenomics.py

import json
from dataclasses import dataclass
from typing import List, Tuple

@dataclass
class TokenomicsConfig:
    # Token supply
    total_supply: int = 1_000_000_000
    
    # Allocations (must sum to 1.0)
    team_pct: float = 0.15          # 15%
    investors_pct: float = 0.10     # 10%
    community_pct: float = 0.40     # 40%
    treasury_pct: float = 0.20      # 20%
    liquidity_pct: float = 0.15     # 15%
    
    # Vesting
    team_cliff_months: int = 12
    team_vest_months: int = 36
    investor_cliff_months: int = 6
    investor_vest_months: int = 24
    
    # Emissions (community rewards, per month)
    monthly_emission_pct: float = 0.005  # 0.5% of supply per month
    
    # Protocol economics
    monthly_protocol_revenue_usd: float = 500_000  # Expected monthly fees
    token_price_usd: float = 1.0          # Starting price
    fee_buyback_pct: float = 0.50         # 50% of fees go to buyback+burn
    
    # Market assumptions
    monthly_organic_demand_tokens: float = 2_000_000  # Non-reward buying

def simulate(config: TokenomicsConfig, months: int = 36) -> List[dict]:
    results = []
    circulating_supply = 0
    cumulative_burned = 0
    
    # Initial liquidity unlock
    circulating_supply += config.total_supply * config.liquidity_pct
    
    for month in range(1, months + 1):
        # Team vesting
        if month > config.team_cliff_months:
            team_monthly = (config.total_supply * config.team_pct) / config.team_vest_months
            circulating_supply += team_monthly
        
        # Investor vesting
        if month > config.investor_cliff_months:
            investor_monthly = (config.total_supply * config.investors_pct) / config.investor_vest_months
            circulating_supply += investor_monthly
        
        # Community emissions
        emission = config.total_supply * config.monthly_emission_pct
        circulating_supply += emission
        
        # Buyback and burn
        usd_for_buyback = config.monthly_protocol_revenue_usd * config.fee_buyback_pct
        tokens_bought_and_burned = usd_for_buyback / config.token_price_usd
        burned_this_month = min(tokens_bought_and_burned, circulating_supply * 0.01)  # Cap at 1% of circ
        circulating_supply -= burned_this_month
        cumulative_burned += burned_this_month
        
        # Net sell pressure (emissions - organic demand - buybacks)
        monthly_sell_pressure = emission - config.monthly_organic_demand_tokens - burned_this_month
        
        # Simple price impact model (rough approximation)
        if monthly_sell_pressure > 0:
            # More sell pressure than demand → price down
            price_impact = -0.02 * (monthly_sell_pressure / (circulating_supply * 0.05))
            config.token_price_usd = max(0.001, config.token_price_usd * (1 + price_impact))
        else:
            # More demand than sell pressure → price up (capped)
            price_impact = 0.01 * abs(monthly_sell_pressure) / (circulating_supply * 0.05)
            config.token_price_usd = config.token_price_usd * (1 + min(price_impact, 0.15))
        
        results.append({
            "month": month,
            "circulating_supply": int(circulating_supply),
            "circulating_pct": round(circulating_supply / config.total_supply * 100, 1),
            "monthly_emission": int(emission),
            "monthly_burned": int(burned_this_month),
            "cumulative_burned": int(cumulative_burned),
            "net_sell_pressure": int(monthly_sell_pressure),
            "token_price_usd": round(config.token_price_usd, 4),
            "market_cap_usd": int(circulating_supply * config.token_price_usd),
            "is_cliff_month": month in [config.team_cliff_months, config.investor_cliff_months],
        })
    
    return results

def print_report(results: List[dict], config: TokenomicsConfig):
    print(f"\n{'='*70}")
    print(f"TOKENOMICS SIMULATION — {len(results)} MONTHS")
    print(f"{'='*70}")
    print(f"{'Month':>5} {'Circ%':>6} {'Price':>8} {'MktCap':>12} {'Net Press':>12} {'Burned':>10}")
    print(f"{'-'*5} {'-'*6} {'-'*8} {'-'*12} {'-'*12} {'-'*10}")
    
    for r in results:
        cliff_marker = " ← CLIFF" if r["is_cliff_month"] else ""
        print(f"{r['month']:>5} {r['circulating_pct']:>5.1f}% "
              f"${r['token_price_usd']:>7.4f} "
              f"${r['market_cap_usd']:>11,.0f} "
              f"{r['net_sell_pressure']:>+12,.0f} "
              f"{r['monthly_burned']:>10,.0f}"
              f"{cliff_marker}")
    
    # Red flags
    print(f"\n{'='*70}")
    print("RED FLAGS DETECTED:")
    declining_months = sum(1 for i in range(1, len(results)) 
                          if results[i]['token_price_usd'] < results[i-1]['token_price_usd'])
    
    if declining_months > len(results) * 0.6:
        print(f"  🚨 Price declining in {declining_months}/{len(results)} months — reduce emissions or increase sinks")
    
    cliff_months = [r for r in results if r["is_cliff_month"]]
    for cliff in cliff_months:
        if cliff["net_sell_pressure"] > 5_000_000:
            print(f"  🚨 Month {cliff['month']} cliff: {cliff['net_sell_pressure']:,.0f} token sell pressure — consider staggering")
    
    final = results[-1]
    if final["token_price_usd"] < config.token_price_usd * 0.5:
        print(f"  🚨 Price at month {len(results)}: ${final['token_price_usd']:.4f} — 50%+ decline from launch")

if __name__ == "__main__":
    config = TokenomicsConfig()
    results = simulate(config, months=36)
    print_report(results, config)
    
    # Save for analysis
    with open("tokenomics_simulation.json", "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nFull results saved to tokenomics_simulation.json")
```

Run it: `python3 scripts/simulate_tokenomics.py`

---

## Fee Revenue Modeling

Before setting protocol fee tiers, model the revenue at different TVL and volume scenarios.

```typescript
// scripts/fee-model.ts
interface ProtocolFeeModel {
  // Protocol parameters
  swapFeeBps: number;           // e.g., 30 = 0.3%
  withdrawalFeeBps: number;     // e.g., 10 = 0.1%
  performanceFeePct: number;    // e.g., 0.10 = 10% of yield

  // Market scenarios (monthly)
  scenarios: Array<{
    name: string;
    avgTvlUsd: number;
    monthlyVolumeUsd: number;
    avgYieldPct: number;
  }>;
}

function modelFeeRevenue(model: ProtocolFeeModel) {
  console.log("\n=== Fee Revenue Model ===\n");
  console.log(`Swap fee: ${model.swapFeeBps}bps | Withdrawal: ${model.withdrawalFeeBps}bps | Performance: ${model.performanceFeePct * 100}%\n`);
  
  for (const scenario of model.scenarios) {
    const swapRevenue = scenario.monthlyVolumeUsd * (model.swapFeeBps / 10_000);
    const withdrawalRevenue = scenario.avgTvlUsd * 0.05 * (model.withdrawalFeeBps / 10_000); // Assume 5% monthly withdrawal rate
    const performanceRevenue = scenario.avgTvlUsd * scenario.avgYieldPct * model.performanceFeePct;
    const totalMonthly = swapRevenue + withdrawalRevenue + performanceRevenue;
    const totalAnnual = totalMonthly * 12;
    
    console.log(`${scenario.name.padEnd(20)}`);
    console.log(`  TVL: $${scenario.avgTvlUsd.toLocaleString()} | Volume: $${scenario.monthlyVolumeUsd.toLocaleString()}/mo`);
    console.log(`  Swap fees:        $${swapRevenue.toLocaleString()}/mo`);
    console.log(`  Withdrawal fees:  $${withdrawalRevenue.toLocaleString()}/mo`);
    console.log(`  Performance fees: $${performanceRevenue.toLocaleString()}/mo`);
    console.log(`  → Total: $${totalMonthly.toLocaleString()}/mo ($${totalAnnual.toLocaleString()}/yr)\n`);
  }
}

modelFeeRevenue({
  swapFeeBps: 30,
  withdrawalFeeBps: 10,
  performanceFeePct: 0.10,
  scenarios: [
    { name: "Bear (Month 3)", avgTvlUsd: 2_000_000, monthlyVolumeUsd: 5_000_000, avgYieldPct: 0.05 },
    { name: "Base (Month 12)", avgTvlUsd: 20_000_000, monthlyVolumeUsd: 50_000_000, avgYieldPct: 0.08 },
    { name: "Bull (Month 24)", avgTvlUsd: 100_000_000, monthlyVolumeUsd: 200_000_000, avgYieldPct: 0.12 },
  ],
});
```

---

## Incentive Design Anti-Patterns

These are the patterns that look smart on a whitepaper and destroy protocols in practice.

```
🚨 MERCENARY LIQUIDITY: Emissions-only liquidity mining with no lock requirement
   → Fix: Require 30-90 day lock to receive emissions. Boosted rewards for longer locks.

🚨 CIRCULAR STAKING: "Stake TOKEN to earn TOKEN" with no underlying revenue
   → Fix: Only pay staking rewards from REAL protocol revenue, not token emissions

🚨 UNPREDICTABLE EMISSIONS: "Governance will set emission rates quarterly"
   → Fix: Hardcode emissions schedule in the program. On-chain, not governance-voted.
   (Governance can vote to reduce emissions, but not increase beyond schedule)

🚨 NO RUNWAY MODELING: "We have 12 months of treasury at current burn"
   → Fix: Model treasury in 3 scenarios: bear (revenue -80%), base, bull
   At least 24 months runway in the bear scenario before launch

🚨 SINGLE TOKEN FLYWHEEL: Revenue → token price up → more TVL → more revenue
   → Fix: This breaks the moment token price drops. Add non-price-dependent mechanisms.
   Protocol should be viable even if token price drops 90%.
```
