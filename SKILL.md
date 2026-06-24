name: solana-token-launch
description: End-to-end TGE coordination for Solana protocols — tokenomics design, token creation, airdrop orchestration, liquidity seeding, market making, listing strategy, post-launch monitoring, and death spiral prevention.
user-invocable: true
cross-domain: true

# Solana Token Launch Skill

> Progressive loader — route to the correct sub-skill based on where you are in the launch lifecycle.
> Do not load all files at once — each is large and task-specific.

## Extends

- [solana-dev-skill](https://github.com/solana-foundation/solana-dev-skill) — Core Solana development

## Cross-Domain Integration Points

This skill bridges 6 domains simultaneously — token engineering, DeFi mechanics, security, legal/compliance, crisis communications, and on-chain analytics. No other token launch skill in the ecosystem covers all 6. Real TGEs require all 6 simultaneously.

---

## Routing Table

### Full TGE coordination (any stage)
→ Load `agents/tge-orchestrator.md`

Use for: Launch coordination, war room setup, launch day decision trees, week-by-week countdown, 40-point readiness scoring, post-launch crisis response.

---

### Token creation (Token-2022 / SPL)
→ Load `skill/spl-token-setup.md`

Use for: Creating a new token with Token-2022, setting extensions (transfer fee, non-transferable, permanent delegate), mint authority setup, Squads v4 multisig configuration, metadata upload to Arweave.

---

### Tokenomics design and vesting
→ Load `skill/tokenomics-design.md`

Use for: Allocation framework, supply sizing, vesting architecture (Streamflow), TGE circulating supply modeling, death spiral early warning system, points-to-token Merkle migration.

---

### Airdrop + Merkle distributor
→ Load `skill/airdrop-orchestration.md`

Use for: Airdrop eligibility design, anti-sybil scoring, Merkle tree construction, on-chain distributor deployment (Anchor), double-claim prevention, OFAC/sanctions screening, claim site architecture.

---

### Liquidity seeding
→ Load `skill/liquidity-seeding.md`

Use for: Meteora DLMM pool creation (bin step selection, fee tier), Orca Whirlpool setup, Raydium CPMM, Alpha Vault (anti-sniper), initial price setting, Jito bundle LP execution.

---

### Market making
→ Load `skill/market-making.md`

Use for: Professional MM selection, Meteora DLMM self-MM rebalancing, spread monitoring, market depth management, launch day market structure.

---

### Jupiter + CEX listing
→ Load `skill/listing-strategy.md`

Use for: Jupiter strict list PR submission, Birdeye/DexScreener info submission, CEX outreach timeline, tier-1 vs tier-2 listing strategy.

---

### Post-launch monitoring + death spiral detection
→ Load `skill/post-launch-monitoring.md`

Use for: Helius webhook setup, real-time sell pressure classification, whale alert system, death spiral detector, LP health monitoring, week-2 pattern detection.

---

### Protocol economics + fee modeling
→ Load `skill/protocol-economics.md`

Use for: Revenue sustainability modeling, buyback-and-burn design, emission schedule simulation, treasury management, value accrual mechanism design.

---

### Legal, compliance, OFAC, MiCA
→ Load `skill/legal-compliance.md`

Use for: Howey test analysis, jurisdiction matrix (US/EU/UAE/SG), geo-blocking implementation, MiCA alignment, OFAC wallet screening, securities law risk assessment.

---

## The 40-Point Readiness Benchmark

Full scoring is in `agents/tge-orchestrator.md`. Summary:

| Score | Status |
|-------|--------|
| 36-40 | Launch-ready |
| 32-35 | Launch-ready with caveats |
| 28-31 | High risk — delay 1 week |
| <28 | Do not launch |

---

## Launch Lifecycle Map

```
DESIGN         → tokenomics-design.md, spl-token-setup.md
DISTRIBUTION   → airdrop-orchestration.md
PRE-LAUNCH     → liquidity-seeding.md, market-making.md, listing-strategy.md, legal-compliance.md
LAUNCH         → tge-orchestrator.md (war room, decision trees)
POST-LAUNCH    → post-launch-monitoring.md, protocol-economics.md
WEEK-2+        → post-launch-monitoring.md (death spiral), protocol-economics.md (buyback)
```
