# Token Launch Ecosystem Signals

> This file defines the cross-skill communication protocol for the Token Launch skill.
> It standardizes how TGE events propagate to Observability, Incident Response,
> and DePIN skills — and how those skills trigger Token Launch actions.

---

## Signal Taxonomy

```
OUTBOUND (Token Launch → other skills)
  ├── Token Launch → Observability  : post-launch monitoring handoff, SLO thresholds
  ├── Token Launch → Incident Response : price collapse, liquidity attack, exploit post-TGE
  └── Token Launch → DePIN          : emission schedule data for DePIN reward system

INBOUND (other skills → Token Launch)
  ├── DePIN → Token Launch           : TGE readiness gate passed (DEPIN_TGE_READY)
  ├── Incident Response → Token Launch : active exploit → pause distributions
  └── Observability → Token Launch   : anomaly alert → trigger crisis playbook
```

---

## Outbound Signal Schemas

### 1. Post-Launch Monitoring Handoff → Observability

Fire this signal at T+0 (token live) to activate observability monitoring.

```typescript
// src/signals/post-launch-handoff.ts
export interface PostLaunchHandoffSignal {
  signal: "TGE_LAUNCHED";
  source_skill: "solana-token-launch-skill";
  network_id: string;              // project slug
  token_mint: string;              // SPL/Token-2022 mint address
  lp_addresses: string[];          // all liquidity pool addresses
  launch_price_usd: number;
  initial_liquidity_usd: number;
  total_supply: bigint;
  circulating_supply_at_tge: bigint;
  vesting_unlock_schedule: Array<{
    date_utc: string;
    amount: bigint;
    allocation_type: "team" | "investors" | "ecosystem" | "treasury";
  }>;
  monitoring_slos: {
    price_floor_24h_pct: number;   // e.g. -30 — alert if drops >30% in 24h
    liquidity_floor_usd: number;   // e.g. 80000 — alert if LP falls below $80K
    holder_growth_min_daily: number; // e.g. 50 — alert if <50 new holders/day
    sell_pressure_max_pct: number; // e.g. 65 — alert if >65% of volume is sells
  };
  handoff_to: "Solana-observabilty-skill";
  timestamp_utc: string;
}

// Emit immediately after token mint + LP seeding confirmed
export async function emitPostLaunchHandoff(
  config: Omit<PostLaunchHandoffSignal, "signal" | "source_skill" | "handoff_to" | "timestamp_utc">,
  webhooks: { observabilityWebhook?: string; discordOpsChannel?: string }
): Promise<void> {
  const signal: PostLaunchHandoffSignal = {
    signal: "TGE_LAUNCHED",
    source_skill: "solana-token-launch-skill",
    handoff_to: "Solana-observabilty-skill",
    timestamp_utc: new Date().toISOString(),
    ...config,
  };

  if (webhooks.observabilityWebhook) {
    await fetch(webhooks.observabilityWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signal),
    });
  }
  if (webhooks.discordOpsChannel) {
    await fetch(webhooks.discordOpsChannel, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `🚀 **TGE LIVE** — \`${config.network_id}\`\nMint: \`${config.token_mint}\`\nPrice: $${config.launch_price_usd}\nLiquidity: $${config.initial_liquidity_usd.toLocaleString()}\n\nObservability monitoring activated. SLO thresholds set.`,
      }),
    });
  }
}
```

### 2. Launch Crisis Signal → Incident Response

Fire when price action or liquidity event requires incident protocol.

```typescript
export interface LaunchCrisisSignal {
  signal: "TGE_CRISIS";
  source_skill: "solana-token-launch-skill";
  severity: "P0" | "P1" | "P2";
  crisis_type:
    | "PRICE_COLLAPSE"           // >40% drop in <1 hour
    | "LIQUIDITY_DRAIN"          // LP TVL drops >50% in <30 min
    | "SNIPER_ATTACK"            // bot cluster extracting value at launch
    | "DISTRIBUTION_EXPLOIT"     // Merkle claim exploit — double-claim detected
    | "VESTING_CONTRACT_EXPLOIT" // unauthorized token release
    | "SELL_PRESSURE_SPIRAL"     // sell volume >80% of total, accelerating;
  token_mint: string;
  network_id: string;
  evidence: {
    tx_signatures: string[];
    price_at_event?: number;
    price_change_pct?: number;
    liquidity_remaining_usd?: number;
  };
  recommended_action:
    | "PAUSE_DISTRIBUTIONS"
    | "PAUSE_LP_SEEDING"
    | "DEPLOY_BUYBACK"
    | "ALERT_AND_MONITOR";
  timestamp_utc: string;
}
```

### 2.5. Reflexivity Defense Stack Signals (VCB + PSV + CWAS)

Fired by the three new defense systems (`vesting-circuit-breaker.md`,
`stabilization-vault.md`, `conviction-scoring.md`) — these are internal
health/action signals, distinct from `TGE_CRISIS` above (which fires on
active exploits/attacks). Route all three to the same monitoring dashboard
as Observability's post-launch handoff.

```typescript
export interface VestingGateEvent {
  signal: "VESTING_GATE_EVALUATED";
  market_health_tier: "HEALTHY" | "WATCH" | "SPIRAL";
  released_amount: bigint;
  deferred_amount: bigint;
  deferred_release_date: string | null;
}
// Escalate to TGE_CRISIS (severity P1) if this fires with tier=SPIRAL for
// 2+ consecutive scheduled unlocks — repeated gating signals a structural
// tokenomics problem, not bad luck.

export interface StabilizationTriggerEvent {
  signal: "STABILIZATION_TRIGGERED";
  drawdown_pct_at_trigger: number;
  buyback_amount_usd: number;
  buybacks_remaining: number;
}
// Escalate to TGE_CRISIS (severity P0, crisis_type: SELL_PRESSURE_SPIRAL) if
// this fires with buybacks_remaining=0 while drawdown is still worsening —
// the mechanical defenses are exhausted; hand off to Incident Response's
// crisis-communication playbook.

export interface ConvictionScoringSummaryEvent {
  signal: "AIRDROP_CONVICTION_SCORED";
  total_wallets_scored: number;
  flagged_for_review: number;
  largest_cluster_size: number;
}
// Fire once per snapshot, before finalizing allocations — this is a
// pre-launch signal, not a post-launch one.
```

---

### 3. Emission Data → DePIN

When Token Launch sets an emission schedule, pass the data to DePIN reward system.

```typescript
export interface EmissionScheduleSignal {
  signal: "TGE_EMISSION_SCHEDULE_LOCKED";
  source_skill: "solana-token-launch-skill";
  network_id: string;
  token_mint: string;
  node_reward_allocation_pct: number;     // % of total supply for node rewards
  total_node_reward_tokens: bigint;
  emission_schedule: Array<{
    epoch: number;
    tokens_available: bigint;
    cumulative_pct_distributed: number;
  }>;
  epoch_length_seconds: number;
  handoff_to: "solana-depin-builder-skill";
  timestamp_utc: string;
}
```

---

## Inbound Signal Handlers

### From DePIN: TGE Readiness Gate Passed

```typescript
// When DePIN builder skill fires DEPIN_TGE_READY:
export interface DepinTGEReadyInbound {
  signal: "DEPIN_TGE_READY";             // from solana-depin-builder-skill
  source_skill: "solana-depin-builder-skill";
  network_id: string;
  readiness_score: number;               // 0-100; must be ≥80 to proceed
  gates: {
    min_nodes_met: boolean;
    geographic_distribution_met: boolean;
    oracle_stability_met: boolean;
    demand_side_revenue_met: boolean;
    security_audit_complete: boolean;
    emission_schedule_locked: boolean;
  };
}

// Token Launch response to DEPIN_TGE_READY:
export function handleDepinTGEReady(signal: DepinTGEReadyInbound): string {
  if (signal.readiness_score < 80) {
    return `DePIN readiness score ${signal.readiness_score}/100 is below threshold. Blocking items must be resolved before loading TGE orchestrator.`;
  }
  const failing = Object.entries(signal.gates)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (failing.length > 0) {
    return `TGE blocked. Failed gates: ${failing.join(", ")}. Load solana-depin-builder-skill → skill/depin-token-launch.md.`;
  }
  return `DePIN gates passed. Loading TGE Orchestrator with DePIN context. Node reward allocation: ${signal.readiness_score}/100. Activate agents/tge-orchestrator.md with depin_mode=true.`;
}
```

### From Incident Response: Pause Distributions

```typescript
export interface IncidentPauseInbound {
  signal: "OBS_ANOMALY_TO_INCIDENT";    // from solana-incident-response-skill
  action_required: "PAUSE_TOKEN_DISTRIBUTIONS";
  token_mint: string;
  incident_id: string;
}
// → Immediately pause Merkle distributor + vesting stream unlocks
// → Load skill/post-launch-monitoring.md → crisis playbook section
```

---

## Signal Router

```typescript
// src/signals/router.ts
export async function routeTokenLaunchSignal(
  signalType: string,
  payload: unknown,
  config: {
    observabilityWebhook?: string;
    incidentWebhook?: string;
    depinWebhook?: string;
    discordOpsChannel?: string;
  }
): Promise<void> {
  switch (signalType) {
    case "TGE_LAUNCHED":
      if (config.observabilityWebhook)
        await fetch(config.observabilityWebhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      break;

    case "TGE_CRISIS":
      const crisis = payload as LaunchCrisisSignal;
      if (config.incidentWebhook)
        await fetch(config.incidentWebhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (config.discordOpsChannel && (crisis.severity === "P0" || crisis.severity === "P1"))
        await fetch(config.discordOpsChannel, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: `🚨 **LAUNCH CRISIS ${crisis.severity}** — ${crisis.crisis_type}\nToken: \`${crisis.token_mint}\`` }) });
      break;

    case "TGE_EMISSION_SCHEDULE_LOCKED":
      if (config.depinWebhook)
        await fetch(config.depinWebhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      break;
  }
}
```

---

## Wallet-Specific Signals (Added v2 — Wallet Engineering Framework)

These signals extend the base ecosystem signals for the full wallet development lifecycle.
All five skills must handle these signals. See `wallet-framework.md` for complete routing.

### WALLET_KEY_COMPROMISED (P0 — Highest Priority)

```typescript
// Fire: Incident Response skill (when key compromise confirmed or suspected)
// Receive: ALL skills
export interface WalletKeyCompromisedSignal {
  signal: "WALLET_KEY_COMPROMISED";
  severity: "P0";
  key_type: "user_wallet" | "fee_payer" | "upgrade_authority" | "mint_authority" | "treasury";
  compromised_address: string;
  confirmed: boolean;
  detected_at_utc: string;
}
// → Load: skill/active-exploit-response.md immediately
// → Load: skill/wallet-security.md → Emergency Key Rotation Checklist
// → Notify all team members within 2 minutes
```

### WALLET_DRAINER_ACTIVE (P1)

```typescript
// Fire: UX skill (intent analyzer blocked a drainer transaction)
// Receive: Incident Response, Observability
export interface WalletDrainerActiveSignal {
  signal: "WALLET_DRAINER_ACTIVE";
  severity: "P1";
  drainer_pattern: "set_authority" | "delegate_approve" | "versioned_alt" | "unknown";
  blocks_in_window: number;
  window_minutes: number;
}
// → Load: skill/wallet-security.md → Drainer Contract Deep Analysis
// → Consider frontend takedown if blocks_in_window > 50
```

### WALLET_FEE_PAYER_CRITICAL (P1)

```typescript
// Fire: Observability skill
// Receive: UX skill (degrade gasless), DePIN (pause proof submission)
export interface WalletFeePayerCriticalSignal {
  signal: "WALLET_FEE_PAYER_CRITICAL";
  severity: "P1";
  alias: string;
  current_balance_sol: number;
  runway_hours: number;
}
// → Load: runbooks/fee-payer-low.md
// → UX: activate graceful degradation (disable gasless, show "pay own gas" flow)
```

### WALLET_ADDRESS_POISONING_DETECTED (P2)

```typescript
// Fire: UX skill
// Receive: Incident Response (comms), Observability (tracking)
export interface WalletAddressPoisoningSignal {
  signal: "WALLET_ADDRESS_POISONING_DETECTED";
  severity: "P2";
  similar_to_address: string;  // The legitimate address being mimicked
  attack_count: number;        // Number of poisoning txs seen
}
// → Load: skill/wallet-security.md → Address Poisoning Response Protocol
// → Post user warning on all official channels
```

### WALLET_SIGNING_LATENCY_HIGH (P2)

```typescript
// Fire: Observability skill
// Receive: UX skill, Performance optimization
export interface WalletSigningLatencySignal {
  signal: "WALLET_SIGNING_LATENCY_HIGH";
  severity: "P2";
  p95_latency_ms: number;
  slo_target_ms: number;
}
// → Load: skill/performance-optimization.md → RPC endpoint failover
// → Check: is latency from RPC or from wallet popup rendering?
```
