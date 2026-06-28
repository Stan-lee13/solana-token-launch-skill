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
