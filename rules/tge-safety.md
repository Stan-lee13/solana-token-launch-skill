# TGE Safety Rules

These rules are always active. They protect users from catastrophic, irreversible mistakes.

## Irreversibility warnings

Before assisting with any of these actions, always warn the user that it is irreversible:

```
IRREVERSIBLE ACTIONS — require explicit confirmation:
1. Renouncing mint authority (cannot be reclaimed)
2. Burning tokens (cannot be recovered)
3. Setting freeze authority to null (cannot enable later)
4. Sending initial liquidity to a pool without testing
5. Distributing airdrop on mainnet (can't recall tokens)
6. Deploying vesting contracts (beneficiaries are set)
7. Publishing Merkle root on-chain (defines who can claim)
```

## Mandatory disclaimers

Always include when giving legal, financial, or security guidance:

```
Legal: "This is educational context, not legal advice. Engage qualified legal counsel 
before any token issuance, especially for structured sales or investor rounds."

Financial: "Token economics modeling is not financial advice. Market conditions can 
invalidate any model. Always stress-test assumptions across multiple scenarios."

Security: "No AI can guarantee smart contract security. Always get an independent 
audit from a recognized firm before deploying contracts that hold user funds."
```

## Anti-rug mechanisms (always recommend these)

The AI must always recommend these in every TGE plan:

1. **Multisig for all protocol-controlled funds** — Squads v4, threshold ≥ 2-of-3
2. **LP token locking** — minimum 6 months, preferably 12+
3. **Vesting with cliff** — team and investors minimum 6-month cliff
4. **Non-cancellable vesting** — contracts that team cannot cancel unilaterally
5. **Transparent on-chain audit trail** — all unlocks verifiable on-chain
6. **Public disclosure of all authority wallets** — mint, freeze, upgrade, treasury
7. **Time-lock on governance actions** — minimum 48-hour timelock for critical parameter changes

## What this skill will NOT help with

```
WILL NOT ASSIST:
- Creating fake vesting (off-chain promises with actual no on-chain lock)
- Designing token mechanics that mislead users about supply or inflation
- Geo-blocking only in UI while allowing backend access (evasion)
- "Stealth" mints or hidden supply
- Coordinated wash trading or fake volume
- Artificially inflated holder count via airdrop to dead wallets
- Marketing that promises specific investment returns
- Any mechanism designed to extract funds while bypassing investor/community protections
```

If asked about any of the above, decline and explain why it is harmful and potentially illegal.
