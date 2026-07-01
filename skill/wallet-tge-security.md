# Wallet Security for Token Launches

> Load this file for the wallet security layer of a Token Generation Event.
> Covers: authority wallet architecture pre/post-TGE, mint authority lockdown,
> airdrop claim wallet security, vesting contract wallet controls, and
> the WALLET_KEY_COMPROMISED response at TGE.
>
> This is the Token Launch-specific extension of:
>
> - `solana-ux-skill/skill/wallet-engineering.md` (architecture principles)
> - `solana-incident-response-skill/skill/wallet-security.md` (compromise response)

---

## TGE Authority Wallet Architecture

A token launch permanently transfers control of enormous value. The wallet architecture
must be production-hardened before the first token is minted.

```
PRE-TGE REQUIRED WALLET SETUP (non-negotiable checklist):

MINT AUTHORITY
  ✅ Transferred to Squads v4 multisig BEFORE any tokens distributed
  ✅ 3-of-5 signers minimum for mainnet (2-of-3 for devnet testing only)
  ✅ No single team member holds > 1 signer key
  ✅ Geographically distributed signers (different cities/countries)
  ✅ At least 1 signer on hardware wallet (Ledger)
  ✅ Rotation procedure documented and tested on devnet
  → If mint authority is not on multisig at TGE: HARD BLOCK — do not launch

FREEZE AUTHORITY
  Option A: Permanently disable (set to None) — cannot freeze user tokens
  Option B: Squads multisig (same as mint) — can freeze in emergency
  Decision: Protocol decides based on regulatory + design requirements
  → Document this decision in legal-compliance.md before TGE

UPGRADE AUTHORITY
  ✅ Squads v4 multisig (can be same as mint, or separate for separation of powers)
  ✅ Time-locked upgrades recommended (>48h delay via governance)
  ✅ Program verified on-chain (source visible) before TGE

TREASURY WALLET
  ✅ Squads v4 multisig — separate from protocol authorities
  ✅ Spending policy documented: purpose + approval threshold per amount
  ✅ Sub-wallets for: ops expenses, market making, team comp, reserves

TEAM VESTING WALLETS
  ✅ Each team member uses hardware wallet for vesting claim
  ✅ Vesting contract is non-transferable during cliff period
  ✅ Claim address is team member's personal wallet (not protocol wallet)
```

---

## Transaction Intent Verification at TGE

TGE day is the highest-risk day for social engineering against your team.
Attackers know your team is stressed, moving fast, and may approve transactions
without careful review. Run intent verification on every transaction.

```typescript
// token-launch/wallet/tge-intent-guard.ts
// Extends analyzeTransactionIntent() from wallet-engineering.md

export type TgeTxType =
  | "mint_tokens"              // Minting new supply — CRITICAL
  | "set_mint_authority"       // Changing mint authority — CRITICAL
  | "initialize_distributor"   // Setting up Merkle airdrop — High
  | "seed_liquidity_pool"      // Adding LP — Medium
  | "initialize_vesting"       // Creating vesting stream — Medium
  | "update_metadata"          // Token metadata update — Low
  | "pause_distribution"       // Emergency pause — Medium
  | "unknown_tge_ix";          // Unknown — DANGER

export const TGE_TX_RISK_MATRIX: Record<TgeTxType, {
  risk: "safe" | "caution" | "danger" | "critical";
  requiresMultisig: boolean;
  humanReadable: string;
  preApprovalCheck: string;
}> = {
  mint_tokens: {
    risk: "critical",
    requiresMultisig: true,
    humanReadable: "Mint new tokens to specified destination",
    preApprovalCheck: "VERIFY: amount matches distribution plan. VERIFY: destination is authorized (distributor contract or team wallet, never external address). This action is irreversible.",
  },
  set_mint_authority: {
    risk: "critical",
    requiresMultisig: true,
    humanReadable: "Transfer mint authority to new address",
    preApprovalCheck: "STOP: This permanently changes who controls token minting. New authority MUST be a Squads multisig address. Verify the exact address before all signers approve.",
  },
  initialize_distributor: {
    risk: "danger",
    requiresMultisig: true,
    humanReadable: "Initialize Merkle airdrop distributor",
    preApprovalCheck: "VERIFY: Merkle root matches the signed-off eligibility snapshot. VERIFY: total claimable amount matches allocation. Once live, the root cannot change.",
  },
  seed_liquidity_pool: {
    risk: "caution",
    requiresMultisig: false,
    humanReadable: "Add initial liquidity to trading pool",
    preApprovalCheck: "VERIFY: pool address is the correct Meteora/Orca/Raydium pool (not a fake). VERIFY: price ratio matches intended launch price.",
  },
  initialize_vesting: {
    risk: "caution",
    requiresMultisig: false,
    humanReadable: "Create vesting stream for recipient",
    preApprovalCheck: "VERIFY: recipient address, cliff date, vesting duration, and total amount match the signed-off vesting schedule.",
  },
  update_metadata: {
    risk: "safe",
    requiresMultisig: false,
    humanReadable: "Update token metadata (name/symbol/URI)",
    preApprovalCheck: "VERIFY: new metadata URI is reachable and contains correct content. Changes are publicly visible immediately.",
  },
  pause_distribution: {
    risk: "caution",
    requiresMultisig: false, // Pause should be fast — not require multisig
    humanReadable: "Pause airdrop/vesting distributions (emergency)",
    preApprovalCheck: "Pause halts all claims until unpaused. Valid reason required — do not pause without a confirmed incident.",
  },
  unknown_tge_ix: {
    risk: "danger",
    requiresMultisig: true,
    humanReadable: "Unknown instruction on token program",
    preApprovalCheck: "⛔ Do not approve. Unknown instructions during TGE are a red flag. Verify with the full team before proceeding.",
  },
};

/**
 * TGE-day signing guard.
 * All TGE transactions go through this before any team member is asked to sign.
 */
export function tgeTxGuard(txType: TgeTxType): {
  blocked: boolean;
  requiresTeamMeeting: boolean;
  checklist: string[];
  warning: string | null;
} {
  const config = TGE_TX_RISK_MATRIX[txType];

  return {
    blocked: config.risk === "critical" && !config.requiresMultisig,
    requiresTeamMeeting: config.risk === "critical" || config.risk === "danger",
    checklist: config.preApprovalCheck.split(". ").filter(Boolean),
    warning:
      config.risk === "critical"
        ? `🚨 CRITICAL TRANSACTION: All ${config.requiresMultisig ? "multisig signers" : "team leads"} must verify before signing. No exceptions.`
        : config.risk === "danger"
        ? `⚠️ HIGH RISK: Get explicit approval from at least 2 team members before proceeding.`
        : null,
  };
}
```

---

## Airdrop Claim Wallet Security (User-Facing)

Airdrops are the highest social-engineering surface in crypto.
Your airdrop claim page will be cloned within minutes of launch.
These are the wallet security patterns that protect users.

```typescript
// token-launch/wallet/claim-guard.ts

/**
 * Domain verification for airdrop claim pages.
 * Display this prominently BEFORE the wallet connect button.
 * Users have been trained to ignore warnings — make this unavoidable.
 */
export function renderClaimDomainWarning(officialDomain: string): {
  currentDomain: string;
  isOfficialDomain: boolean;
  warningLevel: "safe" | "danger";
  userMessage: string;
} {
  const currentDomain =
    typeof window !== "undefined" ? window.location.hostname : "";

  const isOfficialDomain =
    currentDomain === officialDomain ||
    currentDomain.endsWith(`.${officialDomain}`);

  return {
    currentDomain,
    isOfficialDomain,
    warningLevel: isOfficialDomain ? "safe" : "danger",
    userMessage: isOfficialDomain
      ? `✅ You are on the official ${officialDomain} — safe to connect`
      : `🚨 WARNING: You are on ${currentDomain}, NOT the official ${officialDomain}. This may be a phishing site. Do not connect your wallet.`,
  };
}

/**
 * Verify the airdrop claim transaction before showing the approval UI.
 * A legitimate airdrop claim transaction ONLY calls the distributor program.
 * It should NEVER request token approvals, setAuthority, or SOL transfers to unknown addresses.
 */
export function verifyAirdropClaimTx(
  tx: any,
  distributorProgramId: string,
  userPublicKey: string
): { safe: boolean; blockers: string[]; warnings: string[] } {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Check 1: All instructions must be to the distributor program only
  const nonDistributorIxs = (tx.instructions ?? []).filter(
    (ix: any) => ix.programId?.toString() !== distributorProgramId
  );

  if (nonDistributorIxs.length > 0) {
    const programIds = nonDistributorIxs.map((ix: any) => ix.programId?.toString().slice(0, 8) + "...");
    blockers.push(
      `⛔ FRAUD DETECTED: This transaction calls programs beyond the airdrop distributor: ${programIds.join(", ")}. A legitimate airdrop claim ONLY calls the distributor program. Do not approve.`
    );
  }

  // Check 2: Transaction should not include setAuthority
  const hasSetAuthority = (tx.instructions ?? []).some(
    (ix: any) => ix.data?.[0] === 7 // Token program setAuthority discriminator
  );
  if (hasSetAuthority) {
    blockers.push(
      `⛔ DRAINER: This transaction attempts to change token account ownership. This is not part of any legitimate airdrop. Do not approve.`
    );
  }

  // Check 3: SOL transfers should only be to the user (rent returns)
  const solTransfersToUnknown = (tx.instructions ?? []).filter(
    (ix: any) =>
      ix.programId?.toString() === "11111111111111111111111111111111" && // System program
      ix.keys?.[1]?.pubkey?.toString() !== userPublicKey
  );
  if (solTransfersToUnknown.length > 0) {
    warnings.push(
      `⚠️ This transaction sends SOL to an address that is not your wallet. Verify this is an expected fee before approving.`
    );
  }

  return {
    safe: blockers.length === 0,
    blockers,
    warnings,
  };
}
```

---

## Merkle Distributor Key Security

The Merkle distributor's admin key controls who can pause and update claims.
This is a critical authority that must be secured before TGE.

```typescript
// token-launch/wallet/distributor-authority.ts

/**
 * Pre-TGE distributor authority security checklist.
 * Run this verification before deploying the distributor.
 */
export async function verifyDistributorAuthority(
  distributorAddress: string,
  connection: any
): Promise<{
  passed: boolean;
  findings: Array<{ check: string; status: "pass" | "fail" | "warn"; detail: string }>;
}> {
  const findings: Array<{ check: string; status: "pass" | "fail" | "warn"; detail: string }> = [];

  // Fetch distributor account
  const account = await connection.getAccountInfo(distributorAddress);
  if (!account) {
    return {
      passed: false,
      findings: [{ check: "Account exists", status: "fail", detail: "Distributor not deployed" }],
    };
  }

  // Parse admin authority from account data
  // (Implementation depends on which distributor program you use)
  // Aerodrome, Streamflow, or custom Merkle distributor

  findings.push({
    check: "Admin key is a multisig",
    status: "warn", // Verify manually
    detail: "Verify the admin key is a Squads v4 multisig, not a single hot wallet",
  });

  findings.push({
    check: "Merkle root matches signed-off snapshot",
    status: "warn",
    detail: "Verify the root hash matches the CSV file that was reviewed by the team",
  });

  findings.push({
    check: "Claim window configured",
    status: "warn",
    detail: "Verify expiry date allows sufficient time for all eligible wallets to claim",
  });

  return {
    passed: findings.every((f) => f.status !== "fail"),
    findings,
  };
}
```

---

## WALLET_KEY_COMPROMISED Response at TGE

If a mint authority, distributor admin, or vesting contract key is compromised
during or after TGE, the response is time-critical. Every minute costs more tokens.

```
TRIAGE DECISION TREE:

Is the mint authority compromised?
  YES → Squads: immediately remove compromised signer, add replacement
        Priority 1: attacker cannot mint new tokens
        Load: incident-response-skill/skill/active-exploit-response.md

Is the distributor admin key compromised?
  YES → Emergency pause distributor (admin single key is FAST — use it)
        Priority 1: stop claims before attacker drains distributor
        Load: incident-response-skill/skill/wallet-security.md
        Then: redeploy with new admin key

Is a team member's vesting wallet compromised?
  P1 but not P0 — vesting is cliff-locked, attacker can't claim yet
  Priority 1: verify cliff has not passed
  Priority 2: if cliff not passed — cancel vesting, reissue to new wallet
  Load: incident-response-skill/skill/wallet-security.md

Is the treasury key compromised?
  YES → Squads: remove compromised signer immediately
        Load: incident-response-skill/skill/active-exploit-response.md

WHAT TO COMMUNICATE (within 15 minutes of confirming):
  1. Disable all distribution UI (take down website)
  2. Post on all channels: "We are aware of a security issue. Pause all claims."
  3. Do NOT disclose which key until rotation is complete (attacker monitors comms)
  4. Update when rotation confirmed: "Issue resolved. Claims re-enabled."
```

```typescript
// Signal fired when any TGE authority key is compromised
export interface TgeKeyCompromisedSignal {
  signal: "WALLET_KEY_COMPROMISED";
  context: "tge";
  key_type: "mint_authority" | "distributor_admin" | "vesting_admin" | "treasury" | "upgrade_authority";
  compromised_address: string;
  confirmed: boolean;
  tokens_at_risk_description: string;
  immediate_actions: string[];
}

export function buildTgeKeyCompromisedSignal(
  keyType: TgeKeyCompromisedSignal["key_type"],
  address: string,
  confirmed: boolean
): TgeKeyCompromisedSignal {
  const immediateActions: Record<TgeKeyCompromisedSignal["key_type"], string[]> = {
    mint_authority: [
      "Squads: remove compromised signer immediately",
      "Check if attacker has minted new tokens (Helius getSignaturesForAddress)",
      "If minted: calculate damage and prepare community communication",
    ],
    distributor_admin: [
      "Call pause() on distributor immediately (use admin key)",
      "Check if attacker has already drained distributor balance",
      "Redeploy distributor with new admin key after rotation",
    ],
    vesting_admin: [
      "Verify cliff status — if before cliff, attacker cannot claim yet",
      "Cancel affected vesting streams and reissue to new wallets",
    ],
    treasury: [
      "Squads: remove compromised signer immediately",
      "Transfer treasury funds to clean wallet via remaining Squads signers",
    ],
    upgrade_authority: [
      "Squads: remove compromised signer immediately",
      "Monitor for unauthorized program upgrade transactions",
    ],
  };

  return {
    signal: "WALLET_KEY_COMPROMISED",
    context: "tge",
    key_type: keyType,
    compromised_address: address,
    confirmed,
    tokens_at_risk_description: `${keyType} controls token distribution/supply — immediate action required`,
    immediate_actions: immediateActions[keyType],
  };
}
```

---

## Post-TGE Wallet Operations Checklist

Run this monthly for the first year post-TGE.

**Monthly Authority Audit**

- [ ] All Squads multisig signers still have access to their keys
- [ ] No multisig signer's device/key has been compromised or lost
- [ ] Unused authorities have been revoked (old mint authority from setup, etc.)
- [ ] Freeze authority decision documented and consistent with current regulatory view
- [ ] Treasury spending logged and consistent with governance approvals

**Crank/Automation Keypairs**

- [ ] All crank keys are in KMS/Vault (none in `.env` or CI secrets)
- [ ] Crank keys rotated (monthly minimum)
- [ ] Fee payer balances sufficient (>48h runway each)
- [ ] Distribution pause key tested on devnet (verify it still works)

**Vesting Oversight**

- [ ] Upcoming cliff dates known and prepared for sell pressure
- [ ] Each recipient's wallet address verified (they haven't changed wallets)
- [ ] Vesting contract admin key secured (in multisig)

**Cross-Skill Monitoring**

- [ ] `TGE_LAUNCHED` signal confirmed received by Observability skill
- [ ] Wallet security monitoring active (wallet-observability.md alerts live)
- [ ] `WALLET_KEY_COMPROMISED` signal handler tested in staging
