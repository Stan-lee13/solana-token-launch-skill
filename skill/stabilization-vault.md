# Programmatic Stabilization Vault (PSV)

> Load this file when structuring TGE proceeds allocation in `tokenomics-design.md`
> or `liquidity-seeding.md`. Pairs with Vesting Circuit Breaker (supply-side defense)
> to form a full-cycle defense against the Week-2 Death pattern — VCB slows supply
> shocks, PSV actively counters demand-side collapses.

---

## The TradFi mechanism nobody ported to Solana

Traditional IPOs solve exactly this problem with the **greenshoe / over-allotment
option**: underwriters set aside a disclosed pool of capital specifically to buy
back shares if the price drops below the offering price in the first 30 days,
stabilizing the market during the highest-volatility window. It's disclosed,
bounded, rule-based, and has existed in TradFi for decades.

**No Solana token launch skill or common practice documents this pattern.**
Post-TGE, the closest thing teams do is informal, undisclosed "the team bought
some back" — which is legally murkier, unverifiable by holders, and trivially
suspected of being market manipulation because there's no disclosed rule set
behind it. PSV is the disclosed, on-chain, rule-bound version of the same
TradFi mechanism, adapted to an AMM instead of an order book.

## Design

A fixed percentage of TGE proceeds (recommend 5-15%, decided and disclosed
before launch — this is capital the team is explicitly setting aside for
stabilization, not a discretionary later decision) is locked into an on-chain
vault. The vault can **only** execute bounded, rule-triggered buybacks — it
cannot be withdrawn for any other purpose without a disclosed, time-locked
governance action.

```typescript
interface StabilizationVaultConfig {
  vault_pubkey: string;                  // Squads v4 multisig-controlled PDA-owned vault
  total_allocated_usd: number;           // fixed at TGE, disclosed publicly
  trigger_drawdown_pct: number;          // e.g. 35 — vault may act once price drops this much
  max_single_buyback_usd: number;        // e.g. 5% of vault per trigger — prevents a single
                                          // buyback front-running its own price impact
  cooldown_hours_between_buybacks: number; // e.g. 12 — prevents rapid vault drainage
  max_buybacks_total: number;            // hard ceiling on lifetime interventions
  authority: "squads-v4-multisig";       // never a single EOA — see wallet-tge-security.md
}
```

### Execution logic (bounded and mechanical — no discretion at execution time)

```typescript
// Evaluated by the same keeper infra as vesting-circuit-breaker.md and
// post-launch-monitoring.md's death-spiral detector — one shared health read,
// three systems consuming it.
async function evaluateStabilizationTrigger(
  config: StabilizationVaultConfig,
  currentDrawdownPct: number,
  lastBuybackTimestamp: number | null,
  buybacksExecutedCount: number
): Promise<{ shouldTrigger: boolean; buybackAmountUsd: number; reason: string }> {
  if (buybacksExecutedCount >= config.max_buybacks_total) {
    return { shouldTrigger: false, buybackAmountUsd: 0, reason: "lifetime cap reached" };
  }
  if (currentDrawdownPct < config.trigger_drawdown_pct) {
    return { shouldTrigger: false, buybackAmountUsd: 0, reason: "above trigger threshold" };
  }
  const cooldownMs = config.cooldown_hours_between_buybacks * 60 * 60 * 1000;
  if (lastBuybackTimestamp && Date.now() - lastBuybackTimestamp < cooldownMs) {
    return { shouldTrigger: false, buybackAmountUsd: 0, reason: "cooldown active" };
  }
  const remainingVault = config.total_allocated_usd; // minus already-spent, tracked on-chain
  const buybackAmountUsd = Math.min(
    remainingVault * (config.max_single_buyback_usd / config.total_allocated_usd),
    config.max_single_buyback_usd
  );
  return { shouldTrigger: true, buybackAmountUsd, reason: "drawdown trigger met" };
}
```

### On-chain event emission

```typescript
interface StabilizationTriggerEvent {
  signal: "STABILIZATION_TRIGGERED";
  drawdown_pct_at_trigger: number;
  buyback_amount_usd: number;
  vault_remaining_usd: number;
  buyback_tx_signature: string;
  buybacks_executed_total: number;
  buybacks_remaining: number;
}
// Fire on EVERY execution — public, queryable, and cross-referenced against the
// disclosed config so any holder can independently verify the vault only ever
// acted within its own disclosed rules.
```

## Why bounded parameters matter more than the mechanism itself

The mechanism (buy tokens when price drops) is trivial. What makes this
defensible instead of "the team manipulating the market" is:

1. **Disclosed before TGE** — the total allocation, trigger threshold, and caps
   are public before anyone buys the token, not revealed after a crash to
   justify team action.
2. **Mechanically bounded, not discretionary** — the code above has no branch
   where a human decides "should we buy back right now." It's a pure function
   of on-chain state. This is the entire difference between a defensible
   stabilization mechanism and market manipulation.
3. **Capped total exposure** — the vault can run out. It is explicitly not a
   promise that price can't fall below the trigger threshold; it's a
   disclosed, finite cushion, exactly like a real greenshoe option.
4. **Public audit trail** — every trigger emits `STABILIZATION_TRIGGERED` with
   a tx signature. Holders don't have to trust the team's word; they can
   verify the vault behaved exactly per its disclosed rules.

## Legal disclosure requirement

Cross-reference `legal-compliance.md` before implementing this for any token
that will be offered to US persons — a disclosed price-stabilization mechanism
sits in a similar regulatory category to greenshoe options in securities
offerings, and jurisdiction-specific disclosure requirements may apply. This is
not legal advice — flag it explicitly to the project's counsel before launch,
the same way `legal-compliance.md` already flags Howey test analysis.

## Integration with VCB and the rest of the skill

- PSV's vault authority sits on the same Squads v4 multisig pattern mandated
  in `wallet-tge-security.md` — never a single EOA, ever.
- PSV and Vesting Circuit Breaker read the **same** health classification (the
  death-spiral detector in `post-launch-monitoring.md`) so the two systems
  never act on conflicting views of "how healthy is this launch right now."
- If `buybacks_remaining` hits 0 while drawdown is still worsening, that's the
  signal to escalate to Incident Response's crisis-communication playbook —
  the mechanical defenses are exhausted; this becomes a human crisis-response
  situation, not an automation problem.

## Honest limitations

- A stabilization vault sized at 5-15% of TGE proceeds is a cushion, not a
  guarantee — a sufficiently large, sustained sell-off will exhaust it. Size
  it against the Monte Carlo worst-decile drawdown from
  `reflexive-simulation.md`, not against a hopeful assumption.
- This does not fix a genuinely broken tokenomics design (excessive team
  allocation, no real utility, etc.) — it buys time and dampens volatility
  during the highest-risk window. Pair it with actually sound tokenomics
  design in `tokenomics-design.md`, not as a substitute for it.
