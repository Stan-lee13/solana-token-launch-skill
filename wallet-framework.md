# Wallet Engineering Framework — Token Launch

> DePIN-specific entry point into the unified Solana Wallet Engineering Framework.
> Maps every TGE wallet concern to the exact skill file that addresses it.
>
> For the full cross-skill framework, see: `solana-ux-skill/wallet-framework.md`

---

## TGE Wallet Types

| Wallet Type | Owner | Security Tier | Key File |
|---|---|---|---|
| Mint authority | Protocol team | Squads 3-of-5 | `skill/wallet-tge-security.md` |
| Freeze authority | Protocol team | Squads or disabled | `skill/spl-token-setup.md` |
| Upgrade authority | Protocol team | Squads 3-of-5 | `skill/wallet-tge-security.md` |
| Distributor admin | Protocol team | Squads (or fast-pause hot key) | `skill/wallet-tge-security.md` |
| Vesting admin | Protocol team | Squads 2-of-3 | `skill/wallet-tge-security.md` |
| Treasury | Protocol team | Squads 3-of-5 | `skill/wallet-tge-security.md` |
| Team vesting wallets | Individual team members | Hardware wallet | `wallet-framework.md` |
| LP seeding wallet | Protocol team | Hardware wallet | `skill/liquidity-seeding.md` |
| User claim wallets | End users | Any wallet | `skill/airdrop-orchestration.md` |

---

## Load Order by Task

```
"What wallets do I need to set up before TGE?"
  → skill/wallet-tge-security.md → TGE Authority Wallet Architecture

"How do I verify TGE transactions are safe to sign?"
  → skill/wallet-tge-security.md → Transaction Intent Verification at TGE

"How do I protect users claiming our airdrop?"
  → skill/wallet-tge-security.md → Airdrop Claim Wallet Security

"A key is compromised on TGE day"
  → skill/wallet-tge-security.md → WALLET_KEY_COMPROMISED Response at TGE
  → solana-incident-response-skill/skill/active-exploit-response.md

"How do I secure the Merkle distributor?"
  → skill/wallet-tge-security.md → Merkle Distributor Key Security

"Post-TGE monthly wallet audit"
  → skill/wallet-tge-security.md → Post-TGE Wallet Operations Checklist
```

---

## TGE Wallet Security Timeline

```
T-30 days:  Set up all Squads multisigs — test on devnet
T-14 days:  Transfer mint/upgrade authority to Squads — verify on mainnet
T-7 days:   Deploy and verify distributor (admin key = Squads)
T-1 day:    Run full wallet security checklist — all signers confirm access
T-0 (TGE): Every transaction goes through tge-intent-guard.ts before signing
T+1 day:    Verify all authorities still correctly set post-TGE
T+7 days:   First monthly wallet audit
```

---

## Canonical Wallet Signals (Token Launch)

| Signal | Token Launch Role | Action |
|---|---|---|
| `WALLET_KEY_COMPROMISED` | Fires when mint/distributor/treasury compromised | Load `skill/wallet-tge-security.md` response tree |
| `WALLET_DRAINER_ACTIVE` | Fires if airdrop claim page serves drainer | Immediate frontend takedown |
| `WALLET_FEE_PAYER_CRITICAL` | If using gasless claims, fee payer low | Disable gasless claim, switch to user-pays |
| `WALLET_ADDRESS_POISONING_DETECTED` | Users targeted during claim | Add warning banner to claim page |
