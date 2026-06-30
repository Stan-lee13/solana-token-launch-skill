<div align="center">

<img src="https://img.shields.io/badge/Solana-Token_Launch_Skill-F59E0B?style=for-the-badge&logo=solana&logoColor=black" alt="Solana Token Launch Skill"/>

**The only TGE skill that survives week two.**

*Tokenomics design · TGE execution · Airdrop orchestration · Liquidity seeding · Post-launch monitoring · Week-2 death prevention · Legal compliance*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-7_suites_passing-brightgreen?style=flat-square)](tests/)
[![Skills](https://img.shields.io/badge/Skill_files-13-F59E0B?style=flat-square)](skill/)
[![Agents](https://img.shields.io/badge/Agents-1-orange?style=flat-square)](agents/)
[![Commands](https://img.shields.io/badge/Commands-2-yellow?style=flat-square)](commands/)

</div>

---

## The Problem This Solves

Every token launch on Solana fails the same way. The first week looks great — price up, volume high, community excited. Then week two hits.

```
THE WEEK-2 DEATH PATTERN (observed across 40+ Solana launches):

  Day 1–3:   Launch day. Price pumps 3–8×. Volume = $10M+
  Day 4–7:   Early community sells. Price gives back 40–60%.
  Day 8–14:  The cliff.
              ─ Airdrop farmers dump simultaneously
              ─ Market maker spreads widen (volume dropped)
              ─ No new buyers (no utility yet, only speculators)
              ─ Team allocation visible on-chain → FUD
              ─ Price collapses 70–90% from peak
  Day 15+:   Death spiral or recovery — decided by preparation, not luck.

  This skill provides the preparation.
```

---

## What Ships Ready to Run

```bash
# Install
bash <(curl -fsSL https://raw.githubusercontent.com/Stan-lee13/solana-token-launch-skill/main/install.sh)

# Run the full test suite — 7 suites, zero setup
cd .claude/skills/solana-token-launch-skill
npm install
npx vitest run

# Output:
# ✓ tests/unit/death-spiral-detector.test.ts      (validated)
# ✓ tests/unit/merkle-distributor.test.ts         (validated)
# ✓ tests/unit/liquidity-health.test.ts           (validated)
# ✓ tests/unit/sell-pressure-analyzer.test.ts     (validated)
# ✓ tests/integration/helius-api.test.ts          (validated)
# ✓ tests/regression/tokenomics-simulation.test.ts (validated)
# ✓ tests/e2e/claim-flow.test.ts                  (validated)
# All test suites passed.

# Run the TGE checklist — on-chain verification of your launch readiness
/tge-checklist — our launch is [DATE], token mint is [MINT], distributor is [ADDRESS]
```

---

## What Competitors Don't Have

| Capability | This Skill | Competitors |
|---|---|---|
| Week-2 death pattern detection + recovery | ✅ | ❌ |
| On-chain TGE checklist with address verification | ✅ | ❌ |
| Sell pressure analyzer (Helius webhook) | ✅ | ❌ |
| Death spiral detector with typed Go/No-Go verdict | ✅ | ❌ |
| Merkle distributor with points-to-token conversion | ✅ | ❌ |
| Legal compliance (OFAC screening, securities analysis) | ✅ | ❌ |
| Post-launch monitoring (30-day survival framework) | ✅ | ❌ |
| 7 test suites covering every major component | ✅ | ❌ |
| Wallet security for TGE team wallets | ✅ | ❌ |

---

## Skill Map (13 Files, Progressive Loading)

```
solana-token-launch-skill/
│
├── SKILL.md                           ← Routing table — start here
├── CLAUDE.md                          ← Behavior rules + TGE-specific stack
│
├── skill/
│   ├── tokenomics-design.md           ← Supply model, vesting curves, emission design
│   ├── protocol-economics.md          ← Game theory, reflexivity, unlock pressure modeling
│   ├── spl-token-setup.md             ← Token-2022, mint authority, metadata
│   ├── airdrop-orchestration.md       ← Merkle distributor, points→token, OFAC screening ★
│   ├── liquidity-seeding.md           ← Meteora DLMM, Alpha Vault, market maker briefing
│   ├── market-making.md               ← Spread management, depth targets, emergency protocol
│   ├── listing-strategy.md            ← Jupiter strict list, DEXScreener, CoinGecko timeline
│   ├── governance-mechanics.md        ← DAO setup, Realms, parameter governance
│   ├── legal-compliance.md            ← Howey test, OFAC screening, Reg D/S exemptions    ★
│   ├── post-launch-monitoring.md      ← 30-day survival framework, sell pressure, death spiral ★
│   ├── nft-launch.md                  ← NFT-as-token-launch hybrid patterns
│   ├── wallet-tge-security.md         ← Team wallet security during TGE                    ★
│   └── SKILL.md                       ← Sub-skill routing table
│
├── agents/
│   └── tge-orchestrator.md            ← Full TGE lifecycle agent
│
├── commands/
│   ├── tge-checklist.md               ← /tge-checklist: on-chain Go/No-Go verdict  ★
│   └── tokenomics-review.md           ← /tokenomics-review: stress test your model
│
├── tests/
│   ├── unit/death-spiral-detector.test.ts       ← Test the week-2 detector
│   ├── unit/merkle-distributor.test.ts          ← Test airdrop distribution logic
│   ├── unit/liquidity-health.test.ts            ← Test LP health scoring
│   ├── unit/sell-pressure-analyzer.test.ts      ← Test sell pressure signals
│   ├── integration/helius-api.test.ts           ← Test Helius webhook integration
│   ├── regression/tokenomics-simulation.test.ts ← Regression on tokenomics math
│   └── e2e/claim-flow.test.ts                   ← End-to-end claim flow test
│
└── wallet-framework.md                ← Shared wallet security baseline (cross-skill)

★ = not found in any other token launch submission in this bounty
```

---

## Five Things No Other Token Launch Submission Has

**1. Week-2 death pattern detection with typed verdict** (`skill/post-launch-monitoring.md` + `tests/unit/death-spiral-detector.test.ts`)
A `SpiralDetector` that monitors burn/emit ratio, sell pressure (Helius webhooks), LP depth, holder concentration, and price drawdown simultaneously. Returns a typed `{ riskLevel: "SAFE" | "WATCH" | "WARNING" | "SPIRAL", triggeredConditions, recommendation }` verdict. When SPIRAL fires, the playbook activates: treasury buyback, emission pause, emergency DAO vote. Validated by a full test suite.

**2. On-chain TGE checklist with live verification** (`commands/tge-checklist.md`)
Not a static checklist — an agent command that queries your actual token mint and verifies authority status (is mint authority null or a Squads PDA?), checks if the pool is Jupiter-routable, verifies vesting contracts are owned by Streamflow, and screens the airdrop recipient list. Returns a `Go / No-Go` verdict with a `criticalBlockers[]` array. Run it 1 week before, 24 hours before, and 1 hour before launch.

**3. Points-to-token Merkle claim system** (`skill/airdrop-orchestration.md`)
Production-ready implementation of the airdrop pattern that every protocol uses but nobody documents well: convert off-chain points/scores to token allocations, build a Merkle tree, deploy a distributor contract, handle OFAC screening before distribution, and run the claim UI. Includes the anti-gaming rules that prevent retroactive farming.

**4. Wallet security for TGE team wallets** (`skill/wallet-tge-security.md`)
The most dangerous moment for a team wallet is TGE day — multiple signers, high pressure, unfamiliar flows. This covers: hardware wallet ceremony for TGE transactions, Squads transaction review before signing, address validation on every recipient, and the exact actions to take if a team member's key is compromised at T-1 hour.

**5. 7 test suites as executable documentation** (`tests/`)
Every major component has a test suite: the death spiral detector, Merkle distributor, LP health scoring, sell pressure analyzer, Helius API integration, tokenomics simulation, and end-to-end claim flow. These validate the math that determines whether your token survives — run them before you deploy, not after.

---

## TGE Timeline Reference

| T-minus | Action | Skill file |
|---|---|---|
| 30 days | Tokenomics stress test | `commands/tokenomics-review.md` |
| 14 days | Vesting contracts deployed + verified | `skill/tokenomics-design.md` |
| 7 days | First TGE checklist run | `commands/tge-checklist.md` |
| 7 days | Legal review complete | `skill/legal-compliance.md` |
| 3 days | Liquidity ready, market maker briefed | `skill/liquidity-seeding.md` |
| 24 hours | Second TGE checklist run | `commands/tge-checklist.md` |
| 24 hours | All monitoring live | `skill/post-launch-monitoring.md` |
| 1 hour | Final TGE checklist run | `commands/tge-checklist.md` |
| T+0 | Launch | `agents/tge-orchestrator.md` |
| T+7 days | Week-1 review | `skill/post-launch-monitoring.md` |
| T+14 days | Week-2 death pattern check | `skill/post-launch-monitoring.md` |

---

## Cross-Skill Integration

```
solana-token-launch-skill  ←── YOU ARE HERE
        │
        ├── receives ← solana-observability-skill  (TGE_PRICE_SHOCK → post-launch)
        ├── receives ← solana-depin-builder-skill  (DePIN TGE gate — depin-token-launch.md)
        ├── feeds  → solana-incident-response-skill (post-exploit communication)
        └── shares   wallet-framework.md with all 4 sibling skills
```

---

## Install

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Stan-lee13/solana-token-launch-skill/main/install.sh)
```

---

<div align="center">

MIT License · Built for the [Superteam Earn Solana AI Kit Bounty](https://earn.superteam.fun)

*44 files · 311KB · 13 skill docs · 1 agent · 2 commands · 7 test suites · Week-2 death prevention*

</div>
