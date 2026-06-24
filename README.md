<p align="center">
  <strong>solana-token-launch-skill</strong><br/>
  End-to-end TGE intelligence for Solana — from tokenomics design to week-30 health
</p>

[![MIT License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Solana AI Kit](https://img.shields.io/badge/Solana%20AI%20Kit-compatible-green)](https://github.com/solanabr/solana-ai-kit)

---

# solana-token-launch-skill

A production-grade AI skill for the Solana AI Kit that guides founders and engineers through every phase of a Token Generation Event — from tokenomics architecture through launch-day execution, post-launch monitoring, and week-2 death pattern prevention.

**The problem it solves:** Token launch knowledge on Solana is tribal. It lives in private Discord DMs, Twitter threads, and the painful experience of founders who shipped before you. The same preventable mistakes happen repeatedly: tokenomics that collapse under unlock pressure, single EOA holding mint authority, wrong DEX choice, airdrop designs that reward farmers, no legal structure, no monitoring. This skill consolidates every hard lesson into one AI-accessible playbook.

---

## What Competitors Don't Have

Compared to every other token launch submission in this competition:

| Feature | This Skill | Competitors |
|---------|-----------|-------------|
| Week-2 death pattern detection + recovery | ✅ | ❌ |
| Merkle distributor implementation with anti-sybil | ✅ | ❌ |
| Points-to-token migration system | ✅ | ❌ |
| Death spiral detector (tokenomics pressure model) | ✅ | ❌ |
| Launch day sell pressure classifier | ✅ | ❌ |
| Meteora DLMM pool creation code | ✅ | ❌ |
| Streamflow vesting deployment code | ✅ | ❌ |
| Legal jurisdiction matrix (US / EU / UAE / SG) | ✅ | ❌ |
| OFAC screening for airdrop recipients | ✅ | ❌ |
| TGE orchestrator agent with 40-point readiness check | ✅ | ❌ |

---

## What's Included

```
solana-token-launch-skill/
├── SKILL.md                            # Progressive router
├── README.md                           # This file
├── CLAUDE.md                           # Claude Code configuration
├── install.sh                          # One-command installer
├── LICENSE                             # MIT
│
├── skill/
│   ├── SKILL.md                        # Sub-skill routing table
│   ├── tokenomics-design.md            # Supply, allocation, vesting, FDV benchmarks, death spiral model
│   ├── spl-token-setup.md              # Token-2022 / Token Extensions creation, metadata, authorities
│   ├── liquidity-seeding.md            # Meteora DLMM, Orca, Raydium — atomic pool creation
│   ├── airdrop-orchestration.md        # Merkle distributor, anti-sybil scoring, Helius snapshot
│   ├── market-making.md                # Self-MM with Meteora, professional MM selection, spread monitoring
│   ├── listing-strategy.md             # Jupiter strict list, Birdeye, DexScreener, CEX outreach
│   ├── post-launch-monitoring.md       # Week-2 death detection, holder monitoring, anomaly alerts
│   ├── protocol-economics.md           # Revenue sustainability, buy pressure design, treasury management
│   └── legal-compliance.md             # Howey test, jurisdiction matrix, MiCA, geo-blocking, OFAC
│
├── agents/
│   └── tge-orchestrator.md             # Full TGE coordinator — intake, risk escalation, 40-point readiness
│
├── commands/
│   ├── tge-checklist.md                # /tge-checklist — 100-point pre-launch gate check
│   └── tokenomics-review.md            # /tokenomics-review — scored tokenomics audit
│
└── rules/
    └── tge-safety.md                   # Always-on safety rules, anti-rug enforcement
```

---

## Installation

```bash
curl -sSL https://raw.githubusercontent.com/Stan-lee13/solana-token-launch-skill/main/install.sh | bash
```

---

## Usage

### Start a TGE from scratch
```
Load agents/tge-orchestrator.md — launching a DeFi infrastructure token in 6 weeks
```

### Specific phase
```
Load skill/tokenomics-design.md — total supply 1B, need allocation and vesting design

Load skill/airdrop-orchestration.md — need a Merkle distributor for 50K recipients, anti-sybil scoring

Load skill/post-launch-monitoring.md — we launched yesterday, seeing unusual sell pressure

Run /tge-checklist — launch is in 48 hours, token mint is [ADDRESS]

Run /tokenomics-review — here is our tokenomics doc [PASTE]
```

---

## The Week-2 Death Pattern (What Kills Most Launches)

```
Day 0: Launch. Price pumps. Volume is high.
Day 3: Initial excitement fades. Farmer airdrop recipients start selling.
Day 7: Token price -60% from ATH. Community asks "wen utility?"
Day 10: Remaining liquidity dries up. Spread widens to 5%+.
Day 14: Team token unlock cliff hits. Perception: insiders selling.
Day 21: Protocol is functionally dead despite working technology.
```

This skill's `post-launch-monitoring.md` includes the exact detection signals and intervention patterns to identify this trajectory on day 3-5 and intervene before day 7.

---

## Example: Sell Pressure Classification

```typescript
// From post-launch-monitoring.md
const pressure = await classifySellPressure(tokenMint, {
  window: "1h",
  thresholds: { CRITICAL: 0.7, HIGH: 0.5, MEDIUM: 0.3 }
});

// pressure.type = "FARMER_EXIT" | "WHALE_ROTATION" | "ORGANIC_SELLING" | "TEAM_LEAK"
// pressure.recommendation = specific intervention step
```

---

## Ecosystem Integration

| Tool | Coverage |
|------|----------|
| Token-2022 | Token creation, extensions, freeze authority |
| Streamflow Finance | On-chain vesting deployment |
| Meteora DLMM | Pool creation, liquidity seeding, self-MM |
| Orca Whirlpools | Alternative AMM pool setup |
| Helius | Webhook monitoring, holder snapshots, OFAC screening |
| Squads v4 | Mint authority multisig, treasury governance |
| Jito bundles | Protected launch-day operations |
| Jupiter | Strict list submission, routing verification |

---

## License

MIT — free to use, submodule, or extend.

## Author

Built by Victor Stanley ([@Stan-lee13](https://github.com/Stan-lee13)) for the Superteam Earn Solana AI Kit bounty.
