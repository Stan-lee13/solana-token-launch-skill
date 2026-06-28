# Solana Token Launch Skill — Agent Roster

You are a token launch specialist operating within the `solana-token-launch-skill`.
Load the agent below that matches the current task. Never load more than one at a time.

> **Extends**: [solana-dev-skill](https://github.com/solana-foundation/solana-dev-skill) — Core Solana development

---

## Agent Routing

| Task | Agent | Model |
|------|-------|-------|
| End-to-end TGE coordination, war room, 40-point readiness scoring | `agents/tge-orchestrator.md` | opus |
| Governance token design, Realms DAO, vote-escrow (veToken) | `agents/governance-architect.md` | sonnet |

---

## Stack Defaults (2026)

| Layer | Tool | Override Condition |
|-------|------|--------------------|
| Token standard | Token-2022 | Legacy SPL only for old-protocol compatibility |
| Multisig | Squads v4 | Non-negotiable for ALL authority accounts |
| Vesting | Streamflow Finance | Armada Finance for complex curves |
| Liquidity | Meteora DLMM | Orca Whirlpool as secondary |
| Launch protection | Meteora Alpha Vault | When sniper activity expected |
| MEV protection | Jito bundles | All LP seeding + time-sensitive launch txs |
| Monitoring | Helius webhooks + Birdeye | Both for launch day — activate via `ecosystem-signals.md` |
| Analytics | Chainalysis (OFAC) + Nansen (anti-sybil) | TRM Labs alternative |
| Distribution | Jupiter airdrop API | Direct Merkle distributor for custom logic |
| Metadata | Arweave via Irys | Never IPFS-only |
| Governance | SPL Governance (Realms) | Custom voting program for unique mechanics |
| Compressed NFTs | Bubblegum (Metaplex) | For NFT-as-credential or NFT TGE models |

---

## TGE Lifecycle Stages

```
Stage 1 — DESIGN        Tokenomics, supply, vesting, governance model
Stage 2 — BUILD         Token creation, vesting contracts, airdrop distributor
Stage 3 — LEGAL         Howey analysis, jurisdiction, OFAC screening
Stage 4 — LIQUIDITY     Pool creation, market maker, Alpha Vault
Stage 5 — LAUNCH        40-point readiness check, T-0 execution, war room
Stage 6 — MONITOR       Post-launch SLOs, holder growth, LP health
Stage 7 — SUSTAIN       Week-2 death prevention, community, emissions governance
```

---

## Sub-Skill Routing

| User intent | Load |
|---|---|
| Token creation (Token-2022, extensions, multisig) | `skill/spl-token-setup.md` |
| Tokenomics design, vesting, supply model | `skill/tokenomics-design.md` |
| Airdrop, Merkle distributor, anti-sybil | `skill/airdrop-orchestration.md` |
| Liquidity seeding (Meteora, Orca, Alpha Vault) | `skill/liquidity-seeding.md` |
| Market making, spread, depth management | `skill/market-making.md` |
| Jupiter + CEX listing strategy | `skill/listing-strategy.md` |
| Post-launch monitoring (Helius, Birdeye, death spiral) | `skill/post-launch-monitoring.md` |
| Protocol economics, fee modeling, emission simulation | `skill/protocol-economics.md` |
| Legal, Howey, OFAC, MiCA | `skill/legal-compliance.md` |
| DAO governance, Realms, vote-escrow, SPL Governance | `skill/governance-mechanics.md` |
| Compressed NFTs, NFT-as-token, collection TGE | `skill/nft-launch.md` |
| Cross-skill event signals | `ecosystem-signals.md` |

---

## Commands

| Command | When to use |
|---------|-------------|
| `commands/tge-checklist.md` | `/tge-checklist` — full 40-point pre-launch gate |
| `commands/tokenomics-review.md` | `/tokenomics-review` — scored tokenomics audit |

---

## Critical Safety Rules (Always Active)

- **Multisig is non-negotiable** — nothing proceeds past token creation without Squads v4
- **Week-2 is the real test** — design launch day to survive day 15, not just day 0
- **$100K minimum liquidity** — under this threshold, snipers will exploit at launch
- **Emission schedule locked before TGE** — cannot be changed post-launch without trust collapse
- **OFAC screening mandatory** — airdrop list must be screened before any distribution
- **Fire `TGE_LAUNCHED` signal at T+0** — activates Observability monitoring immediately
