# solana-token-launch-skill

> A production-grade AI skill for the [Solana AI Kit](https://github.com/solanabr/solana-ai-kit) that guides founders and engineers through every phase of a Token Generation Event (TGE) on Solana — from tokenomics design to post-launch monitoring.

---

## The problem this solves

Every Solana project eventually does a token launch. It is the single highest-stakes, most irreversible event in a protocol's lifecycle — and founders consistently make the same preventable mistakes:

- Poorly designed tokenomics that collapse under sell pressure
- Single EOA holding mint authority (rug risk)
- Wrong DEX choice or insufficient liquidity at launch
- Airdrop designs that reward farmers, not genuine users
- No legal structure, then regulatory problems 6 months later
- No monitoring infrastructure — blind to attacks and manipulation

No existing skill in the Solana AI Kit covers any of this. This skill covers all of it, end-to-end.

---

## What's included

```
solana-token-launch-skill/
├── SKILL.md                          # Entry point — routes to sub-skills by phase
├── README.md
├── install.sh
├── skill/
│   ├── SKILL.md                      # Sub-skill hub
│   ├── tokenomics-design.md          # Supply, allocation, vesting, FDV benchmarking
│   ├── spl-token-setup.md            # Token-2022 / Token Extensions creation
│   ├── liquidity-seeding.md          # Meteora DLMM, Orca, Raydium — pool init + atomic seeding
│   ├── airdrop-orchestration.md      # Merkle distributor, anti-sybil, Helius snapshot
│   ├── listing-strategy.md           # Jupiter, DEX/CEX listing, market making
│   ├── post-launch-monitoring.md     # Helius webhooks, holder tracking, anomaly detection
│   └── legal-compliance.md           # Howey test, jurisdiction matrix, MiCA, geo-blocking
├── agents/
│   └── tge-orchestrator.md           # Full TGE planning agent with intake + risk escalation
├── commands/
│   ├── tge-checklist.md              # /tge-checklist — 100-point pre-launch safety check
│   └── tokenomics-review.md          # /tokenomics-review — scored tokenomics audit
└── rules/
    └── tge-safety.md                 # Always-on safety rules, anti-rug enforcement
```

---

## Installation

```bash
# One-line install into your Claude Code / Codex project
curl -sSL https://raw.githubusercontent.com/Stan-lee13/solana-token-launch-skill/main/install.sh | bash
```

Or manually:

```bash
git clone https://github.com/Stan-lee13/solana-token-launch-skill.git
cd solana-token-launch-skill
bash install.sh
```

---

## Usage

### Full TGE orchestration from scratch

```
Load agents/tge-orchestrator.md and start planning my token launch
```

### Specific phase help

```
I need to design tokenomics for a DeFi infrastructure token — load the tokenomics skill
Help me create a Token-2022 token with metadata — load spl-token-setup
I'm seeding liquidity on Meteora DLMM — load liquidity-seeding skill
Run /tge-checklist before we launch tomorrow
Review my tokenomics: /tokenomics-review
```

### What the agent knows (2026 stack)

| Layer | Tools covered |
|---|---|
| Token standard | Token-2022 (Token Extensions), legacy SPL Token |
| Metadata | Metaplex Core, Token-2022 native metadata, Arweave/Irys, IPFS/Pinata |
| Vesting | Streamflow Finance, Armada Finance |
| Multisig | Squads v4 |
| DEX | Meteora DLMM, Meteora Alpha Vault, Orca Whirlpools, Raydium CLMM |
| Aggregator | Jupiter V3 |
| MEV protection | Jito bundles |
| RPC / Indexing | Helius (webhooks, DAS API, getTokenAccounts) |
| Legal | MiCA, Howey test, SAFT, jurisdiction matrix (US, EU, UAE, Cayman, BVI, Singapore, Switzerland) |
| Sanctions | Chainalysis, TRM Labs |
| KYC | Persona, Sumsub, Synaps, Fractal ID |
| Monitoring | Helius webhooks, Birdeye, DexScreener, Grafana |
| Airdrop | Merkle distributor (Jito Foundation implementation) |

---

## Design principles

**Progressive / token-efficient** — the top-level SKILL.md routes to only the sub-skill needed. Full context is never loaded unless the full TGE orchestration agent is invoked.

**Production-grade** — every code snippet is written against the current 2026 SDK versions. This is not toy demo code.

**Opinionated** — the skill takes positions (Token-2022 over legacy SPL, Meteora DLMM for new launches, Squads v4 for multisig) and explains why. Founders don't need a menu of options — they need a starting recommendation.

**Safety-first** — `rules/tge-safety.md` is always active. The skill will not assist with mechanics designed to deceive or harm users.

---

## 2026 compatibility

Tested against:
- `@solana/web3.js` v2
- `@solana/spl-token` v0.4+ (Token-2022 support)
- `@meteora-ag/dlmm` latest
- `@orca-so/whirlpools-sdk` v0.13+
- `@sqds/multisig` v2+
- `@streamflow/stream` latest
- `helius-sdk` latest
- `@jito-foundation/merkle-distributor` latest

---

## License

MIT — free to use, merge, or submodule into the Solana AI Kit.

---

## Author

Built by Victor Stanley ([@Stan-lee13](https://github.com/Stan-lee13)) for the Superteam Earn Solana AI Kit bounty.

Contributions welcome — open a PR or reach out.
