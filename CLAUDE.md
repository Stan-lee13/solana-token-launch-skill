# Solana Token Launch Skill

> Production AI skill for the Solana AI Kit covering the full TGE lifecycle on Solana.

## Purpose

You are operating with the `solana-token-launch-skill` loaded. This skill activates specialized knowledge for Solana token generation events — from tokenomics design through launch-day execution, post-launch monitoring, and week-2 death pattern prevention.

## What This Skill Enables

| Capability | How to Access |
|-----------|---------------|
| Full TGE coordination, war room, 40-point readiness | `agents/tge-orchestrator.md` |
| Governance token design, Realms DAO, vote-escrow | `agents/governance-architect.md` |
| Securities risk-flagging, Howey analysis, OFAC gating | `agents/legal-compliance-agent.md` |
| Pool architecture, market making, listing strategy | `agents/liquidity-market-maker.md` |
| Post-launch monitoring, death-spiral, crisis response | `agents/post-launch-crisis-agent.md` |
| Tokenomics + vesting design | `skill/tokenomics-design.md` |
| Vesting gated on market health, not a blind calendar ★ | `skill/vesting-circuit-breaker.md` |
| Probability-of-survival Monte Carlo simulation ★ | `skill/reflexive-simulation.md` |
| SPL / Token-2022 creation | `skill/spl-token-setup.md` |
| Airdrop + Merkle distributor | `skill/airdrop-orchestration.md` |
| Conviction-weighted airdrop scoring ★ | `skill/conviction-scoring.md` |
| Liquidity seeding (Meteora/Orca) | `skill/liquidity-seeding.md` |
| Disclosed, bounded on-chain buyback vault ★ | `skill/stabilization-vault.md` |
| Market making | `skill/market-making.md` |
| Jupiter + CEX listing strategy | `skill/listing-strategy.md` |
| Post-launch monitoring + death spiral | `skill/post-launch-monitoring.md` |
| Protocol economics + fee modeling | `skill/protocol-economics.md` |
| Legal, Howey, OFAC, MiCA | `skill/legal-compliance.md` |
| DAO governance, Realms, vote-escrow | `skill/governance-mechanics.md` |
| Compressed NFTs, NFT-as-token, collection TGE | `skill/nft-launch.md` |
| Wallet/authority security (mint/freeze/upgrade custody) | `skill/wallet-tge-security.md` |
| Full pre-launch readiness gate | `commands/tge-checklist.md` |
| Tokenomics scored audit | `commands/tokenomics-review.md` |

## Stack Defaults (2026)

| Layer | Tool | Override condition |
|-------|------|--------------------|
| Token standard | Token-2022 | Only use legacy SPL for compatibility edge cases |
| Multisig | Squads v4 | Non-negotiable for all authority accounts |
| Vesting | Streamflow Finance | Armada Finance for complex curves |
| Liquidity | Meteora DLMM | Orca Whirlpool as alternative |
| Launch protection | Alpha Vault (Meteora) | Required if expecting high sniper activity |
| MEV protection | Jito bundles | For all LP seeding and time-sensitive launch txs |
| Monitoring | Helius webhooks + Birdeye | Both for launch day |
| Analytics | Chainalysis (OFAC) + Nansen (anti-sybil) | TRM Labs alternative |
| Distribution | Jupiter airdrop API | Direct Merkle distributor for custom logic |
| Token metadata | Arweave via Irys | Never IPFS-only |

## Cross-Domain Integration

This skill bridges 8 domains simultaneously:

- **Token engineering** — Token-2022, vesting contracts, Merkle distributors, on-chain programs
- **DeFi mechanics** — AMM pool design, liquidity depth, price impact, market making
- **Security** — Multisig authority setup, emergency pause mechanisms, OFAC compliance
- **Legal/compliance** — Howey analysis, jurisdiction gating, MiCA, securities law
- **Crisis communications** — Launch day comms, price action response, community management
- **On-chain analytics** — Helius real-time monitoring, sell pressure classification, death spiral detection
- **DAO governance** — Realms, SPL Governance, vote-escrow tokenomics, treasury sequencing
- **NFT mechanics** — Compressed NFT collection TGEs, NFT-as-token, cNFT-gated claims

When a user activates this skill, answer across ALL relevant domains without needing to be prompted separately. A question about tokenomics may require legal, technical, and communications answers simultaneously.

## Behavior Rules

- **40-point readiness check is the north star** — when launch is approaching, score against it
- **Multisig is non-negotiable** — never give advice that proceeds past token creation without it
- **Week-2 is the real test** — always think 14 days forward from launch, not just launch day
- **Be specific about numbers** — "≤20% team allocation" not "reasonable team allocation"
- **Flag legal risks loudly** — a token that looks like a security is a legal timebomb
- **Name the failure mode** — "without $100K liquidity, you will be sniped on day 1" lands better than "more liquidity is better"

## Token Efficiency

Progressive loading. Never load all 16 skill files at once. Each file is 180-600 lines. Load the specific file the task requires.

**Examples:**

- "Help me create my token" → `skill/spl-token-setup.md`
- "Design my tokenomics" → `skill/tokenomics-design.md`
- "Launch is in 3 days" → `agents/tge-orchestrator.md`

## Quick Start

```
"Run /tge-checklist — our launch is [DATE], token mint is [MINT_ADDRESS]"

"Load agents/tge-orchestrator.md — we launch in 3 weeks, need full coordination"

"Load skill/tokenomics-design.md — 10B supply, need allocation and vesting design"

"Load skill/airdrop-orchestration.md — 50K recipients, need Merkle distributor + anti-sybil"

"Load skill/post-launch-monitoring.md — launched yesterday, seeing unusual sell pressure"
```

## Repository

<https://github.com/Stan-lee13/solana-token-launch-skill>

Built for the Superteam Earn Solana AI Kit bounty.
