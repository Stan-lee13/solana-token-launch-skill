# Vesting Circuit Breaker (VCB)

> Load this file when designing vesting/unlock schedules for `tokenomics-design.md`.
> Extends the standard time-based vesting curve with a market-health gate.

---

## The problem with pure time-based vesting

Every vesting scheme in production today — Streamflow, Bonfida, custom Anchor
programs — releases tokens on a fixed calendar, entirely blind to market
conditions. A cliff hits on day 90 whether the token is up 40% or down 85%
from launch. This is precisely how a scheduled unlock compounds an *existing*
death spiral: team/investor tokens hit the market at the worst possible
moment, purely because a calendar said so, adding supply-side pressure right
when the market can least absorb it.

**No unlock schedule in the Solana ecosystem currently gates release on
real-time market health.** This is a structural gap, not a minor feature
request — vesting design in `tokenomics-design.md` and death-spiral detection
in `post-launch-monitoring.md` currently live as two disconnected systems that
don't talk to each other. VCB is the connective layer.

## Design

VCB doesn't replace the vesting calendar — it adds a **market-health gate**
that a scheduled unlock must pass before tokens actually become claimable,
with bounded, disclosed, governance-set parameters (this is NOT a discretionary
"team decides on the day" override — that reintroduces the exact trust
problem vesting exists to solve).

```
SCHEDULED UNLOCK DATE ARRIVES
        │
        ▼
┌───────────────────────────────────────┐
│ Check market health (same signals as  │
│ post-launch-monitoring.md's death-    │
│ spiral detector):                     │
│  - price drawdown from launch         │
│  - LP TVL vs. mcap ratio              │
│  - sell-pressure classification       │
└───────────────────┬───────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
    HEALTHY       WATCH         SPIRAL
   (proceed      (partial      (defer full
   on schedule)   release,     unlock, release
                  see below)   only a disclosed
                                minimum trickle)
```

### Bounded response tiers (set at TGE, immutable without a governance vote — not adjustable ad-hoc)

```typescript
interface VestingGateConfig {
  // Health thresholds — mirror death-spiral-detector.md's own SPIRAL/WATCH bands
  // so the two systems can never disagree about what "healthy" means.
  healthyDrawdownCeilingPct: number;   // e.g. 40 — below this, release on schedule
  watchDrawdownCeilingPct: number;     // e.g. 70 — above healthy, below this = WATCH

  // Bounded response — NOT "pause indefinitely," which just becomes a rug in a
  // different shape. Deferred tokens accrue and release later; they are never burned
  // or redirected without a separate, explicit governance action.
  watchTierReleasePct: number;         // e.g. 40 — release 40% of the scheduled amount, defer the rest
  spiralTierReleasePct: number;        // e.g. 10 — release a disclosed minimum, defer the rest

  maxDeferralDays: number;             // e.g. 90 — hard ceiling; after this, tokens release
                                        // regardless of market health (prevents indefinite
                                        // limbo — recipients are owed clarity on a bound)
}
```

### On-chain event emission (integrates with ecosystem-signals.md)

```typescript
// Fired every time a scheduled unlock is evaluated, whether gated or not —
// full transparency is the trust mechanism here, not discretion.
interface VestingGateEvent {
  signal: "VESTING_GATE_EVALUATED";
  scheduled_unlock_date: string;
  scheduled_amount: bigint;
  market_health_tier: "HEALTHY" | "WATCH" | "SPIRAL";
  released_amount: bigint;
  deferred_amount: bigint;
  deferred_release_date: string | null; // null if released in full
  drawdown_pct_at_evaluation: number;
  lp_tvl_ratio_at_evaluation: number;
}

// If tier is WATCH or SPIRAL for 2+ consecutive scheduled unlocks, escalate:
// signal: "VESTING_REPEATEDLY_GATED" → fire to Incident Response per
// ecosystem-signals.md — repeated gating is itself a signal something
// structural is wrong with the tokenomics design, not just bad luck.
```

## Why disclosure at TGE is non-negotiable

This mechanism MUST be disclosed in the TGE documentation and ideally in the
token's legal/compliance materials (`legal-compliance.md`) **before launch**,
not retrofitted after a crash. An undisclosed vesting gate discovered after
the fact reads as exactly the kind of discretionary rug-pull-adjacent behavior
vesting was designed to prevent. Disclosed, bounded, and symmetric (it only
ever *defers*, never *cancels or redirects*) is the difference between "smart
tokenomics design" and "the team moved the goalposts."

## Anchor implementation notes

**This is now a real, compiled program**, not pseudocode — `programs/vesting-circuit-breaker/src/lib.rs`.
Verified with `cargo check` (Anchor 0.30.1, stable Rust) — zero compile errors.
Instructions: `initialize_gate`, `evaluate_gate` (keeper-signed), and
`release_matured_deferral` (permissionless once `max_deferral_seconds` elapses —
the hard ceiling that guarantees recipients are never left in indefinite limbo).
Emits `VestingGateEvaluated` and, on 2+ consecutive gated events,
`VestingRepeatedlyGated` for the `ecosystem-signals.md` escalation path.

**Disclosed scope limit:** the program takes `current_drawdown_bps` as a
keeper-signed instruction argument, not a live on-chain oracle read (the
"off-chain keeper + on-chain attestation" path below). The keeper authority
MUST be a Squads v4 multisig PDA per `wallet-tge-security.md` — this program
enforces the release math and bounds; it does not by itself enforce who your
keeper is. Wiring a direct Pyth/Switchboard read is the natural next step
before mainnet use; see the two paths below.



The gate check reads the same on-chain price/LP oracle data that
`post-launch-monitoring.md`'s off-chain sell-pressure analyzer computes.
Two implementation paths:

- **On-chain oracle read** (Pyth/Switchboard price feed + LP TVL from the pool
  account directly) — fully trustless, no off-chain dependency, but limited to
  whatever data those oracles expose.
- **Off-chain keeper + on-chain attestation** — a keeper bot (same
  infrastructure as `post-launch-monitoring.md`'s Helius webhook listener)
  computes the full health classification (drawdown + LP ratio + sell
  pressure) and posts a signed attestation on-chain that the vesting program
  reads. More flexible (uses the full death-spiral-detector logic, not just
  what's oracle-available) but adds a trusted-keeper assumption — mitigate
  with a multisig-controlled keeper key per `wallet-tge-security.md`, and
  publish the attestation logic so it's independently verifiable off-chain.

Most teams should start with the off-chain keeper path (faster to ship,
reuses `post-launch-monitoring.md`'s existing detector) and mirror to an
on-chain oracle-only fallback if the keeper attestation goes stale for more
than `maxDeferralDays / 3`.

## Integration checklist

- [ ] Health thresholds match `post-launch-monitoring.md`'s death-spiral tiers exactly
- [ ] `maxDeferralDays` disclosed in TGE docs and legal materials
- [ ] `VESTING_GATE_EVALUATED` wired to `ecosystem-signals.md`
- [ ] Keeper key (if used) on Squads v4 multisig per `wallet-tge-security.md`
- [ ] Deferred-token accounting is transparent and independently queryable — recipients
      can always check exactly how much is deferred and when it unlocks
