# DEPLOYMENT.md — Token Launch Operational Runbook

This is the war-room reference for launch day. Keep this tab open alongside Grafana.

## Pre-Launch Checklist (T-24h)

```bash
# Verify program deployment
solana program show <PROGRAM_ID> --url mainnet-beta
# ✅ Upgrade authority = Squads multisig PDA
# ✅ Program is NOT upgradeable if you've burned upgrade authority

# Verify token mint authority
spl-token display <TOKEN_MINT>
# ✅ Mint authority = Squads multisig (or null if supply is fixed)
# ✅ Freeze authority = null (unless intentional)

# Verify Merkle distributor is funded
spl-token balance --address <DISTRIBUTOR_VAULT>
# Must match total airdrop allocation

# Verify liquidity pool is seeded
# Check Meteora: https://app.meteora.ag/pools/<POOL_ADDRESS>
# Expected: initial TVL = your seed amount

# Test emergency pause (devnet first)
anchor invoke --program <PROGRAM_ID> --instruction emergency_pause
# Must succeed. Unpause immediately after test.

# Verify monitoring is live
curl https://your-grafana.com/api/health
# Expected: {"commit":"...","database":"ok","version":"..."}
```

## Launch Sequence (T-0)

```
T-60m:  On-call team assembles in war room (Discord/Slack)
T-30m:  Final checklist review — all systems green
T-15m:  Market maker confirms they are ready
T-10m:  Announce countdown on X / Discord
T-5m:   Unpause program (if launched paused)
T-0m:   LP pool goes live — note exact block number
T+5m:   Confirm first swap executed — check DexScreener
T+15m:  Verify Helius webhooks firing — check monitoring dashboard
T+30m:  First holder count — confirm growth trend
T+1h:   Brief war room: price, volume, LP health, any anomalies
```

## War Room Monitoring Tabs

Keep these open on launch day:

| Tab | URL | What to watch |
|-----|-----|---------------|
| DexScreener | `https://dexscreener.com/solana/<POOL>` | Price, volume, buy/sell ratio |
| Birdeye | `https://birdeye.so/token/<MINT>` | Holder count, concentration |
| Solscan | `https://solscan.io/token/<MINT>` | Large transfers, whale activity |
| Grafana | Your dashboard | `lp_tvl_usd`, `top10_concentration_pct`, webhook queue depth |
| Helius Webhook Logs | Helius dashboard | Webhook delivery status, error rate |

## Incident Escalation

```
SEV 1 — Price drops >30% in 30 min:
  → Load post-launch-monitoring.md → Week 2 Death counter-playbook
  → Page market maker immediately
  → Prepare emergency buyback from treasury (Squads transaction)

SEV 2 — LP out of range (>30 min):
  → Load skill/liquidity-seeding.md → DLMM rebalancing section
  → Squads: propose rebalance transaction
  → Market maker notified

SEV 3 — Whale wallet selling >$500K:
  → Monitor next 30 min for coordinated exit signal
  → Prepare staking announcement if sell pressure continues
  → Load post-launch-monitoring.md → Sell Pressure Detection

SEV 4 — Oracle / crank failure:
  → Load skill/incident-response-integration.md
  → Check KMS key status: aws kms describe-key --key-id <KEY_ID>
  → Failover crank: ssh deploy@<BACKUP_CRANK_IP> systemctl restart depin-crank
```

## Rollback Procedure

```bash
# Program upgrade via Squads (requires 3-of-5 signatures)
# 1. Build the rollback binary
anchor build --verifiable

# 2. Create Squads upgrade transaction
squads-cli program-upgrade create \
  --multisig <SQUADS_PDA> \
  --program-id <PROGRAM_ID> \
  --buffer <PREVIOUS_BUFFER_ADDRESS>

# 3. Team approves in Squads UI → executes upgrade
# 4. Verify on Solscan: program data account updated

# NEVER use the deploy keypair for upgrades on mainnet
# All upgrades must go through Squads multisig
```

## Post-Launch Handoffs

```
T+24h:  Publish launch recap (price, volume, holders, key events)
T+7d:   Weekly metrics review — KPIs vs targets in post-launch-monitoring.md
T+14d:  Week 2 Death window closes — assess and communicate
T+30d:  First monthly report — load skill/governance-mechanics.md if DAO live
T+90d:  Stale crank key rotation (see runbooks/oracle-key-compromise.md)
```
