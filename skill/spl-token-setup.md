# SPL Token Setup (Token-2022 / Token Extensions)

Create production-grade Solana tokens with the current 2026 standard. Token-2022 (Token Extensions Program) is the default — it supersedes the legacy SPL Token program for all new launches.

## Decision: Legacy SPL Token vs Token-2022

| Feature | Legacy SPL Token | Token-2022 (Extensions) |
|---|---|---|
| Transfer fees | ❌ | ✅ |
| Confidential transfers | ❌ | ✅ |
| Permanent delegate | ❌ | ✅ |
| Non-transferable | ❌ | ✅ |
| Interest-bearing | ❌ | ✅ |
| Metadata on-chain | ❌ (Metaplex separate) | ✅ (native) |
| Wallet support | Universal | Most major wallets (Phantom, Backpack, Solflare) |
| DEX support | Universal | Jupiter + most major DEXes ✅ |

**Recommendation:** Use Token-2022 for all new launches. Legacy SPL only if you require compatibility with an older protocol that hasn't upgraded.

## Token-2022 Extension Selection Guide

### Most commonly needed extensions for TGE

**Transfer Fee Extension** — take a protocol fee on every transfer
```typescript
import {
  createInitializeMintInstruction,
  createInitializeTransferFeeConfigInstruction,
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  getMintLen,
} from "@solana/spl-token";

const extensions = [ExtensionType.TransferFeeConfig];
const mintLen = getMintLen(extensions);

// Transfer fee: 0.1% (10 basis points), max fee: 1000 tokens
const transferFeeConfigAuthority = multisigPDA; // Use Squads multisig
const withdrawWithheldAuthority = multisigPDA;
const feeBasisPoints = 100; // 1%
const maxFee = BigInt(1_000_000_000); // in base units
```

**Metadata Extension** — store token metadata directly on-chain
```typescript
import {
  createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction,
  TYPE_SIZE,
  LENGTH_SIZE,
} from "@solana/spl-token";
import {
  createInitializeInstruction,
  pack,
  TokenMetadata,
} from "@solana/spl-token-metadata";

const metadata: TokenMetadata = {
  updateAuthority: updateAuthorityKP.publicKey,
  mint: mint.publicKey,
  name: "MyToken",
  symbol: "MTK",
  uri: "https://arweave.net/<your-metadata-json>",
  additionalMetadata: [["description", "My Solana token"]],
};
```

**Permanent Delegate** — useful for protocol-controlled burns or compliance
```typescript
import { ExtensionType, createInitializePermanentDelegateInstruction } from "@solana/spl-token";
// WARNING: This extension gives the delegate power to transfer/burn any token account's balance.
// Only use if your protocol requires it. Disclose prominently.
```

## Full production token creation flow

```typescript
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  getMintLen,
  ExtensionType,
  createInitializeMetadataPointerInstruction,
} from "@solana/spl-token";
import { createInitializeInstruction, pack, TokenMetadata } from "@solana/spl-token-metadata";

// Use Helius for reliable RPC
const connection = new Connection("https://mainnet.helius-rpc.com/?api-key=YOUR_KEY");

// NEVER use a throwaway keypair for mint authority in production
// Use a Squads v4 multisig PDA as mintAuthority and freezeAuthority
const mintKeypair = Keypair.generate();
const squadsMultisigPDA = /* your Squads multisig PDA */;

const metadata: TokenMetadata = {
  updateAuthority: squadsMultisigPDA,
  mint: mintKeypair.publicKey,
  name: "YourToken",
  symbol: "YTK",
  uri: "https://arweave.net/your-metadata",
  additionalMetadata: [],
};

const extensions = [ExtensionType.MetadataPointer];
const mintLen = getMintLen(extensions);
const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;

const mintLamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataLen);

const transaction = new Transaction().add(
  SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: mintKeypair.publicKey,
    space: mintLen,
    lamports: mintLamports,
    programId: TOKEN_2022_PROGRAM_ID,
  }),
  createInitializeMetadataPointerInstruction(
    mintKeypair.publicKey,
    squadsMultisigPDA, // update authority = multisig
    mintKeypair.publicKey,
    TOKEN_2022_PROGRAM_ID
  ),
  createInitializeMintInstruction(
    mintKeypair.publicKey,
    decimals,           // 9 for most tokens, 6 for stablecoins
    squadsMultisigPDA,  // mintAuthority = multisig
    squadsMultisigPDA,  // freezeAuthority = multisig (or null if you want permissionless)
    TOKEN_2022_PROGRAM_ID
  ),
  createInitializeInstruction({
    programId: TOKEN_2022_PROGRAM_ID,
    metadata: mintKeypair.publicKey,
    updateAuthority: squadsMultisigPDA,
    mint: mintKeypair.publicKey,
    mintAuthority: squadsMultisigPDA,
    name: metadata.name,
    symbol: metadata.symbol,
    uri: metadata.uri,
  })
);
```

## Metadata hosting

### Option 1: Arweave (permanent, recommended)
```bash
# Use Irys (formerly Bundlr) for Arweave upload
npm install -g @irys/sdk

# Upload metadata JSON
irys upload metadata.json \
  --network mainnet \
  --token solana \
  --wallet ./keypair.json
```

### Option 2: IPFS via Pinata
```bash
curl -X POST "https://api.pinata.cloud/pinning/pinFileToIPFS" \
  -H "Authorization: Bearer YOUR_JWT" \
  -F "file=@metadata.json"
```

**Metadata JSON structure:**
```json
{
  "name": "YourToken",
  "symbol": "YTK",
  "description": "One-sentence description of what this token does",
  "image": "https://arweave.net/your-image-hash",
  "external_url": "https://yourprotocol.com",
  "attributes": [],
  "properties": {
    "category": "fungible"
  }
}
```

## Authority management (critical for security)

```
Mint Authority:    Squads v4 multisig  ← Who can mint new tokens
Freeze Authority:  Squads v4 multisig  ← Who can freeze accounts (or null)
Update Authority:  Squads v4 multisig  ← Who can update metadata
```

### Squads v4 multisig setup
```typescript
import * as multisig from "@sqds/multisig";

const [multisigPda] = multisig.getMultisigPda({ createKey });

await multisig.instructions.multisigCreate({
  connection,
  creator: creator.publicKey,
  multisigPda,
  configAuthority: null,   // immutable config
  threshold: 2,             // 2-of-3 recommended for launch
  members: [
    { key: member1.publicKey, permissions: multisig.types.Permissions.all() },
    { key: member2.publicKey, permissions: multisig.types.Permissions.all() },
    { key: member3.publicKey, permissions: multisig.types.Permissions.all() },
  ],
  timeLock: 0,
  rentCollector: null,
});
```

## Post-creation checklist

- [ ] Mint authority transferred to Squads multisig
- [ ] Freeze authority set (or explicitly nulled with justification)
- [ ] Metadata uploaded to permanent storage (Arweave preferred)
- [ ] Token verified on Solscan / SolanaFM
- [ ] Metadata visible in Phantom, Backpack, Solflare
- [ ] Initial mint to treasury wallet completed
- [ ] Total supply matches tokenomics design exactly
- [ ] Mint authority will be renounced or retained (decision documented)

## Should you renounce mint authority?

| Scenario | Recommendation |
|---|---|
| Fixed supply, no inflation planned | Renounce mint authority at TGE or after initial distribution |
| Protocol may need future emissions | Retain under Squads multisig with governance vote required |
| Stablecoin / RWA | Retain — minting is core to the mechanism |

Renouncing = credibility signal. Retaining under multisig + governance = acceptable. Retaining under a single EOA = red flag.
