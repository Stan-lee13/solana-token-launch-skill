# Solana Token Launch Skill

A complete Token Generation Event (TGE) playbook for Solana — from token creation through exchange listing, market making, airdrop orchestration, and post-launch monitoring.

## When to load this skill

Load this skill when the user needs to:
- Create a Token-2022 (Token Extensions) token
- Design tokenomics and vesting schedules
- Plan and execute an airdrop
- Seed liquidity on Meteora / Orca / Raydium
- Set up market making (self or professional)
- Get listed on Jupiter, Birdeye, DexScreener, CoinGecko
- Navigate legal and compliance requirements
- Monitor token health post-launch

## Sub-skill routing

Load the specific sub-skill file based on the user's current stage:

| Stage | File |
|-------|------|
| Creating the token (mint, extensions, metadata, authorities) | `skill/spl-token-setup.md` |
| Designing supply, allocation, vesting | `skill/tokenomics-design.md` |
| Running an airdrop (eligibility, snapshots, Merkle distribution) | `skill/airdrop-orchestration.md` |
| Seeding initial DEX liquidity | `skill/liquidity-seeding.md` |
| Market making (Meteora DLMM, professional MMs, spread monitoring) | `skill/market-making.md` |
| CEX listing, Jupiter routing, Birdeye/CMC/CoinGecko | `skill/listing-strategy.md` |
| Legal structure, KYC, regulatory compliance | `skill/legal-compliance.md` |
| Post-launch monitoring (holders, LP health, whale alerts) | `skill/post-launch-monitoring.md` |

## Agents

- `tge-orchestrator` — master coordinator for the full TGE lifecycle

## Commands

- `/tge-checklist` — full pre-launch readiness checklist
- `/tokenomics-review` — review and red-flag a tokenomics design

## Rules

- `tge-safety.md` — always-on safety rules (vesting enforcement, authority controls, legal flags)

## TGE timeline overview

```
T-4 weeks:  Token created, multisig authorities set, tokenomics finalized
T-3 weeks:  Vesting contracts deployed (Streamflow), airdrop list prepared
T-2 weeks:  Liquidity seeded on Meteora, Jupiter routing confirmed
T-1 week:   Market maker onboarded, Birdeye/DexScreener listed, legal signed off
T-0:        Public launch, CoinGecko/CMC application submitted
T+1 week:   Tier 3-4 CEX listings, monitoring dashboard live
T+1 month:  Tier 2 CEX discussions, perps listing applications
```
