# Security Policy

## Scope

This repository is a skill (documentation + code examples). Security concerns that apply:

- **Code examples** containing exploitable vulnerabilities (e.g., unsafe key handling, missing validation)
- **Architecture patterns** that would lead to insecure token authority setups
- **Airdrop/distributor patterns** with exploitable double-claim or bypass vectors
- **Vesting contract examples** with unauthorized-release vulnerabilities

Out of scope: vulnerabilities in the live tools referenced (Streamflow, Meteora, Realms) — report those to the respective project.

## Reporting

If you find a vulnerability in a code example or architectural pattern:

1. **Do NOT open a public issue** — this could enable exploits on live protocols following the pattern
2. Use GitHub's private vulnerability reporting feature
3. Include: file path, line number, the vulnerability, proof-of-concept if applicable, and suggested fix

We will acknowledge within 72 hours and aim to resolve within 7 days.

## Critical Warning

Code in this skill is for educational reference. Before using any pattern from this skill on mainnet:

1. Engage a qualified Solana security auditor (OtterSec, Neodyme, Sec3, Trail of Bits)
2. Complete a full program audit — especially for distributor, vesting, and governance contracts
3. Test all authority transfers on devnet before mainnet
4. Verify multisig configuration before announcing the token publicly

Key patterns that REQUIRE independent security review before mainnet:
- `skill/spl-token-setup.md` — mint authority transfer to Squads
- `skill/airdrop-orchestration.md` — Merkle distributor deployment
- `skill/governance-mechanics.md` — veToken locking program
- `skill/tokenomics-design.md` — emission schedule locking
