# Contributing to solana-token-launch-skill

## What This Skill Is

A production AI skill for the Solana AI Kit covering the full TGE lifecycle on Solana. All contributions must maintain the standard: **depth that a founder shipping a real token launch on mainnet would trust under pressure.**

## High-Value Contributions

- New sub-skill files for uncovered launch mechanics
- Updated tooling versions when the Solana ecosystem moves (e.g., new Meteora SDK, Streamflow API changes)
- Real post-mortem patterns (anonymized) from live launches
- Legal jurisdiction updates as regulatory frameworks change
- Improved anti-sybil scoring models backed by real airdrop data

## Quality Bar

Every skill file must include:

1. A decision tree or "when to use" section at the top
2. At least one complete, runnable TypeScript code example
3. Anti-patterns section — what NOT to do and the exact failure mode it causes
4. Cross-skill integration notes (feeds to/from Observability, Incident Response, DePIN)

Every code example must:

- Use current library APIs (check package.json dates)
- Handle errors explicitly
- Include security notes for any key or authority handling
- Not require paid API keys without documenting a free alternative

## File Organization

```
skill/         → Sub-skill files (progressive loading)
agents/        → Agent personas with identity + operating procedures
commands/      → /command implementations (/tge-checklist, /tokenomics-review)
rules/         → Always-on safety rules (auto-loaded)
```

## Submitting

1. Fork the repo, branch: `feat/<skill-name>` or `fix/<description>`
2. One skill file per PR — keeps review focused
3. Include a one-paragraph description of what launch failure mode this prevents
4. Test all code examples before submitting

## Do Not Add

- Protocol-specific promotional content
- Speculation about future regulatory outcomes presented as fact
- Code that calls paid APIs without free alternatives documented
- Files duplicating existing skill content (check routing table first)
