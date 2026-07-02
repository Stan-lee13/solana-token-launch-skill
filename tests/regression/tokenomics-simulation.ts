/**
 * Reference implementation — Tokenomics Simulation (TypeScript mirror)
 * Mirrors scripts/simulate_tokenomics.py — see tests/regression/tokenomics-simulation.test.ts
 * for both the pure-logic tests AND the cross-language parity check that runs
 * the actual Python script and diffs its output against this mirror.
 */

export interface SimConfig {
  total_supply: number;
  team_pct: number;
  investors_pct: number;
  community_pct: number;
  treasury_pct: number;
  liquidity_pct: number;
  team_cliff_months: number;
  team_vest_months: number;
  investor_cliff_months: number;
  investor_vest_months: number;
  monthly_emission_pct: number;
  monthly_protocol_revenue_usd: number;
  token_price_usd: number;
  fee_buyback_pct: number;
  monthly_organic_demand_tokens: number;
}

export interface MonthResult {
  month: number;
  circulating_supply: number;
  cumulative_burned: number;
  net_monthly_emission: number;
  sell_pressure_usd: number;
  demand_usd: number;
  implied_price: number;
}

export const DEFAULT_CONFIG: SimConfig = {
  total_supply: 1_000_000_000,
  team_pct: 0.15,
  investors_pct: 0.10,
  community_pct: 0.40,
  treasury_pct: 0.20,
  liquidity_pct: 0.15,
  team_cliff_months: 12,
  team_vest_months: 36,
  investor_cliff_months: 6,
  investor_vest_months: 24,
  monthly_emission_pct: 0.005,
  monthly_protocol_revenue_usd: 500_000,
  token_price_usd: 1.0,
  fee_buyback_pct: 0.50,
  monthly_organic_demand_tokens: 2_000_000,
};

export function simulate(config: SimConfig, months: number = 36): MonthResult[] {
  const results: MonthResult[] = [];
  let circulating = config.total_supply * config.liquidity_pct;
  let burned = 0;

  for (let month = 1; month <= months; month++) {
    if (month > config.team_cliff_months) {
      circulating += (config.total_supply * config.team_pct) / config.team_vest_months;
    }
    if (month > config.investor_cliff_months) {
      circulating += (config.total_supply * config.investors_pct) / config.investor_vest_months;
    }

    const emission = config.total_supply * config.monthly_emission_pct;
    circulating += emission;

    const usd_for_buyback = config.monthly_protocol_revenue_usd * config.fee_buyback_pct;
    const tokens_burned = usd_for_buyback / config.token_price_usd;
    circulating -= tokens_burned;
    burned += tokens_burned;

    const net_monthly_emission = emission - tokens_burned;
    const sell_pressure_usd = net_monthly_emission * config.token_price_usd;
    const demand_usd = config.monthly_organic_demand_tokens * config.token_price_usd + usd_for_buyback;

    results.push({
      month,
      circulating_supply: Math.round(circulating),
      cumulative_burned: Math.round(burned),
      net_monthly_emission: Math.round(net_monthly_emission),
      sell_pressure_usd: Math.round(sell_pressure_usd),
      demand_usd: Math.round(demand_usd),
      implied_price: config.token_price_usd, // simplified (real sim adjusts dynamically)
    });
  }
  return results;
}
