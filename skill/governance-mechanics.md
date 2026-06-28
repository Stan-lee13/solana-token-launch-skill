# Governance Mechanics — Realms DAO, SPL Governance, Vote-Escrow

> Load when designing or implementing a governance system for a Solana token.
> Covers: SPL Governance (Realms), vote-escrow (veToken), delegation, treasury control,
> proposal UX, and governance token design trade-offs.

---

## Governance Architecture Decision Tree

```
WHAT DO YOU NEED TO GOVERN?
├── Protocol parameters (fees, configs) + treasury
│   → SPL Governance (Realms) — battle-tested, audited, Squads-compatible
│
├── DeFi protocol upgrade authority
│   → Squads v4 multisig with governance timelock
│   → NOT SPL Governance alone — too slow for emergency response
│
├── Long-term protocol direction + token emissions
│   → veToken model (vote-escrow) — aligns long-term holders
│   → Realms with custom voter weight plugin
│
└── DAO with on-chain treasury + grants
    → Realms DAO with governance treasury + Squads for execution
    → Proposal → timelock → Squads execution
```

---

## SPL Governance (Realms) Setup

### Program IDs (Mainnet, June 2026)

```typescript
// Known program IDs
const SPL_GOVERNANCE_PROGRAM_ID = new PublicKey("GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw");
const VOTER_WEIGHT_REGISTRY_PROGRAM_ID = new PublicKey("VoterWeightAddin111111111111111111111111111111");
```

### Creating a Realm (TypeScript)

```typescript
import {
  withCreateRealm,
  MintMaxVoteWeightSource,
  GovernanceConfig,
  VoteThresholdPercentage,
  VoteTipping,
} from "@solana/spl-governance";
import { Connection, PublicKey, Keypair, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";

const connection = new Connection(process.env.HELIUS_RPC_URL!);

async function createRealm(
  communityMint: PublicKey,   // your governance token mint
  councilMint: PublicKey,     // optional: team/council multisig token
  name: string,               // "MyProtocol DAO"
  payer: Keypair
): Promise<PublicKey> {
  const instructions: TransactionInstruction[] = [];

  // Community token config
  const communityTokenConfig = {
    useVoterWeightAddin: false,   // set true for veToken plugin
    useMaxVoterWeightAddin: false,
    tokenType: "Liquid",          // Liquid = standard; Dormant = locked
  };

  const realmPubkey = await withCreateRealm(
    instructions,
    SPL_GOVERNANCE_PROGRAM_ID,
    2,                            // program version
    name,
    payer.publicKey,              // realm authority
    communityMint,
    payer.publicKey,              // payer
    councilMint,                  // optional council
    MintMaxVoteWeightSource.SUPPLY_FRACTION,
    new BN(1_000_000_000_000_000), // 10% of supply for vote weight max
    communityTokenConfig,
    undefined                     // no council token config
  );

  const tx = new Transaction().add(...instructions);
  await sendAndConfirmTransaction(connection, tx, [payer]);
  return realmPubkey;
}
```

### Governance Configuration

```typescript
// Design decisions that define your DAO's behavior
const governanceConfig: GovernanceConfig = {
  // Minimum tokens to create a proposal (prevents spam)
  // Set to 0.1% of circulating supply
  minCommunityTokensToCreateProposal: new BN(1_000_000_000), // 1M tokens

  // Minimum council tokens to create a proposal (team override)
  minCouncilTokensToCreateProposal: new BN(1),

  // Voting duration
  maxVotingTime: 3 * 24 * 60 * 60, // 3 days in seconds (standard)

  // Quorum: percentage of circulating tokens that must vote
  communityVoteThreshold: new VoteThresholdPercentage({
    value: 10,  // 10% quorum — standard for DeFi DAOs
  }),

  // Approval threshold: % of YES votes to pass
  // (Note: this is % of votes cast, not % of total supply)
  communityVetoVoteThreshold: new VoteThresholdPercentage({
    value: 60,  // 60% YES required to pass
  }),

  // Vote tipping: when does voting end early?
  communityVoteTipping: VoteTipping.Strict,
  // Strict = waits for full voting period
  // Early = ends when quorum + approval threshold met
  // Disabled = always waits full period

  // Timelock: delay between vote passing and execution
  votingCoolOffTime: 24 * 60 * 60,    // 24h timelock (minimum for security)
  depositExemptProposalCount: 10,
};
```

---

## Vote-Escrow (veToken) Design

veToken is the gold standard for long-term alignment. Users lock tokens for 1-4 years to receive voting power that decays linearly as unlock date approaches.

### Core veToken Mechanics

```typescript
// src/governance/ve-token.ts

interface VeTokenPosition {
  owner: string;                  // wallet pubkey
  locked_amount: bigint;          // tokens locked
  lock_end_epoch: number;         // when tokens unlock
  voting_power: bigint;           // decays linearly until unlock
  created_at: number;
}

// Voting power formula: tokens × (remaining_lock_time / max_lock_time)
// Max lock = 4 years, Min lock = 1 week
const MAX_LOCK_SECONDS = 4 * 365 * 24 * 60 * 60;  // 4 years
const MIN_LOCK_SECONDS = 7 * 24 * 60 * 60;          // 1 week

export function calculateVotingPower(
  lockedAmount: bigint,
  lockEndTimestamp: number,
  currentTimestamp: number = Math.floor(Date.now() / 1000)
): bigint {
  const remainingSeconds = Math.max(0, lockEndTimestamp - currentTimestamp);
  if (remainingSeconds === 0) return 0n;

  // veToken: 1 token locked for 4 years = 1 vote
  //          1 token locked for 1 year = 0.25 votes
  //          1 token locked for 1 week = ~0.005 votes
  const power = (lockedAmount * BigInt(remainingSeconds)) / BigInt(MAX_LOCK_SECONDS);
  return power;
}

// Maximum voting power: lock for 4 years
export function maxVotingPower(amount: bigint): bigint {
  return amount; // 1:1 at max lock
}

// Lock extension: users can extend their lock to regain voting power
export function canExtendLock(
  position: VeTokenPosition,
  newLockEndTimestamp: number
): { canExtend: boolean; reason?: string } {
  if (newLockEndTimestamp <= position.lock_end_epoch) {
    return { canExtend: false, reason: "New lock end must be after current lock end" };
  }
  const maxEnd = Math.floor(Date.now() / 1000) + MAX_LOCK_SECONDS;
  if (newLockEndTimestamp > maxEnd) {
    return { canExtend: false, reason: "Lock period exceeds maximum of 4 years" };
  }
  return { canExtend: true };
}
```

### Anchor Program: veToken Locking

```rust
// programs/governance/src/instructions/lock_tokens.rs
use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Mint};

#[derive(Accounts)]
pub struct LockTokens<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + VePosition::SPACE,
        seeds = [b"ve-position", user.key().as_ref()],
        bump
    )]
    pub ve_position: Account<'info, VePosition>,

    #[account(mut, constraint = user_token_account.owner == user.key())]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut, seeds = [b"ve-vault"], bump)]
    pub ve_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct VePosition {
    pub owner: Pubkey,
    pub locked_amount: u64,
    pub lock_end_timestamp: i64,
    pub bump: u8,
}

impl VePosition {
    pub const SPACE: usize = 32 + 8 + 8 + 1;

    pub fn voting_power(&self, current_timestamp: i64) -> u64 {
        let max_lock: i64 = 4 * 365 * 24 * 60 * 60;
        let remaining = (self.lock_end_timestamp - current_timestamp).max(0);
        if remaining == 0 { return 0; }
        (self.locked_amount as i64 * remaining / max_lock) as u64
    }
}

pub fn lock_tokens(
    ctx: Context<LockTokens>,
    amount: u64,
    lock_end_timestamp: i64,
) -> Result<()> {
    let clock = Clock::get()?;
    let min_lock_end = clock.unix_timestamp + 7 * 24 * 60 * 60;
    let max_lock_end = clock.unix_timestamp + 4 * 365 * 24 * 60 * 60;

    require!(lock_end_timestamp >= min_lock_end, GovernanceError::LockTooShort);
    require!(lock_end_timestamp <= max_lock_end, GovernanceError::LockTooLong);
    require!(amount > 0, GovernanceError::ZeroAmount);

    // Transfer tokens to escrow vault
    anchor_spl::token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::Transfer {
                from: ctx.accounts.user_token_account.to_account_info(),
                to: ctx.accounts.ve_vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount,
    )?;

    let position = &mut ctx.accounts.ve_position;
    position.owner = ctx.accounts.user.key();
    position.locked_amount += amount;
    position.lock_end_timestamp = lock_end_timestamp;

    emit!(TokensLockedEvent {
        owner: position.owner,
        amount,
        lock_end_timestamp,
        voting_power: position.voting_power(clock.unix_timestamp),
    });

    Ok(())
}
```

---

## Governance Token Design Trade-Offs

```typescript
// Three governance token models — choose one before TGE

export const GOVERNANCE_MODELS = {
  "pure-liquid": {
    description: "Standard ERC20/SPL token — 1 token = 1 vote",
    pros: [
      "Simple UX — no lock required",
      "Maximum liquidity — tokens freely transferable",
      "Easy to onboard passive holders",
    ],
    cons: [
      "Plutocratic — large holders dominate",
      "No long-term alignment — tokens can be borrowed for a vote then sold",
      "Whale coordination risk — governance attacks via borrowed tokens",
    ],
    use_when: "Consumer-facing protocol with large community and low governance risk",
  },

  "ve-token": {
    description: "Vote-escrow — lock tokens for 1-4 years, receive time-weighted votes",
    pros: [
      "Long-term alignment — lockers have skin in the game",
      "Reduces mercenary voting — locked tokens cannot exit",
      "Fee revenue to lockers — creates direct incentive to vote",
    ],
    cons: [
      "Complexity — users must understand lock mechanics",
      "Reduces liquidity — locked tokens leave circulation",
      "Bribery markets emerge (Curve Wars dynamics)",
    ],
    reference: "Curve CRV/veCRV model, adapted for Solana",
    use_when: "DeFi protocol where emissions governance matters (liquidity rewards)",
    implementation: "Anchor lock_tokens.rs above + Realms voter weight plugin",
  },

  "delegated-council": {
    description: "Token holders elect council; council executes proposals",
    pros: [
      "Fast decisions — council acts without full token vote",
      "Expertise — elected members are protocol experts",
      "Emergency response — council can act in hours, not days",
    ],
    cons: [
      "Centralization risk — council capture",
      "Accountability requires strong slashing/removal mechanism",
    ],
    use_when: "Infrastructure protocol where governance speed matters",
    implementation: "SPL Governance council mint + multisig council",
  },
};
```

---

## Realms Voter Weight Plugin (for veToken)

```typescript
// Connect veToken positions to Realms for on-chain governance
// This makes your custom veToken voting power visible to Realms proposals

import { PublicKey } from "@solana/web3.js";

// The voter weight record tells Realms how much voting power a wallet has
// Your off-chain or on-chain veToken calculator writes to this PDA

const VOTER_WEIGHT_RECORD_SEEDS = (
  realmPubkey: PublicKey,
  governingTokenMint: PublicKey,
  walletPubkey: PublicKey
) => [
  Buffer.from("voter-weight-record"),
  realmPubkey.toBuffer(),
  governingTokenMint.toBuffer(),
  walletPubkey.toBuffer(),
];

// Your program writes the voter weight for each locker
// Realms reads it when a wallet tries to vote
interface VoterWeightRecord {
  realm: PublicKey;
  governingTokenMint: PublicKey;
  governingTokenOwner: PublicKey;
  voterWeight: bigint;              // total voting power from veToken
  voterWeightExpiry?: number;       // slot when this record expires (optional)
  weightAction?: string;
  weightActionTarget?: PublicKey;
  reserved: number[];
}
```

---

## Treasury Governance Pattern

```typescript
// Multi-sig treasury with governance timelock
// Pattern: Realms proposal → passes → Squads executes after timelock

// Step 1: Treasury controlled by Squads v4 multisig
// Step 2: Squads members are the elected council OR governance program itself
// Step 3: Token holders vote via Realms to approve treasury actions
// Step 4: After 24h-72h timelock, Squads members sign and execute

// Treasury address: PDA of the governance realm
// Always use the realm treasury PDA — never a raw wallet

const TREASURY_SEED = (realmPubkey: PublicKey) =>
  ["native-treasury", realmPubkey.toBuffer()];

// For protocol fee collection → treasury
// For grants → governance proposal → timelock → Squads execution
// For emergency → council vote only (faster than full governance)
```

---

## Governance Launch Timing

```
BEFORE TGE:
  □ Governance token design finalized (liquid / veToken / delegated)
  □ Realm created on Realms.today — test on devnet first
  □ Initial parameters set (quorum %, approval %, timelock)
  □ Council multisig seeded (founding team)
  □ Treasury PDA funded (from ecosystem allocation)

AT TGE:
  □ Community tokens distributed → holders can now create proposals
  □ First governance proposal: ratify initial parameters
  □ Council election proposal queued (if delegated model)

POST-TGE (Week 2+):
  □ First community proposal: typically fee parameter
  □ Monitor: quorum participation rate (target >5%)
  □ Governance health = ecosystem strength signal
```
