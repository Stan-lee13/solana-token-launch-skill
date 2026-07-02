//! Vesting Circuit Breaker (VCB)
//!
//! Gates scheduled token unlocks on real-time market health instead of a blind
//! calendar date. See skill/vesting-circuit-breaker.md for the full design
//! rationale and the off-chain keeper architecture this composes with.
//!
//! IMPORTANT — read before deploying: this program takes `market_health_tier`
//! as a keeper-signed instruction argument (the "off-chain keeper + on-chain
//! attestation" path documented in vesting-circuit-breaker.md), NOT a live
//! on-chain oracle read. The keeper authority MUST be a Squads v4 multisig PDA
//! per wallet-tge-security.md — a single EOA keeper defeats the entire point
//! of a non-discretionary, trust-minimized gate. This program enforces the
//! math and the bounds; it does not by itself enforce who your keeper is.
//! Wire a real Pyth/Switchboard read here before using this beyond a testnet
//! reference implementation.

use anchor_lang::prelude::*;

declare_id!("VCB1acdF7XQ2vgD5hT8m7ynACD5D9GvHXwEQ4pMLcbb");

#[program]
pub mod vesting_circuit_breaker {
    use super::*;

    pub fn initialize_gate(
        ctx: Context<InitializeGate>,
        healthy_drawdown_ceiling_bps: u16,
        watch_drawdown_ceiling_bps: u16,
        watch_tier_release_bps: u16,
        spiral_tier_release_bps: u16,
        max_deferral_seconds: i64,
        scheduled_unlock_amount: u64,
    ) -> Result<()> {
        require!(
            healthy_drawdown_ceiling_bps < watch_drawdown_ceiling_bps,
            VcbError::InvalidThresholdOrdering
        );
        require!(watch_drawdown_ceiling_bps <= 10_000, VcbError::InvalidBps);
        require!(watch_tier_release_bps <= 10_000, VcbError::InvalidBps);
        require!(spiral_tier_release_bps <= 10_000, VcbError::InvalidBps);
        // Worse market health must never release MORE than a milder tier —
        // without this, a misconfigured gate (e.g. spiral_tier_release_bps=8000,
        // watch_tier_release_bps=5000) would unlock a LARGER fraction of the
        // scheduled amount during a spiral than during a mere watch state,
        // which is exactly backwards from the entire purpose of this program.
        require!(
            spiral_tier_release_bps <= watch_tier_release_bps,
            VcbError::InvalidTierOrdering
        );
        require!(max_deferral_seconds > 0, VcbError::InvalidDeferralWindow);

        let gate = &mut ctx.accounts.gate;
        gate.authority = ctx.accounts.authority.key();
        gate.healthy_drawdown_ceiling_bps = healthy_drawdown_ceiling_bps;
        gate.watch_drawdown_ceiling_bps = watch_drawdown_ceiling_bps;
        gate.watch_tier_release_bps = watch_tier_release_bps;
        gate.spiral_tier_release_bps = spiral_tier_release_bps;
        gate.max_deferral_seconds = max_deferral_seconds;
        gate.scheduled_unlock_amount = scheduled_unlock_amount;
        gate.deferred_amount = 0;
        gate.deferred_since = 0;
        gate.consecutive_gated_events = 0;
        gate.bump = ctx.bumps.gate;
        Ok(())
    }

    /// Evaluated by the keeper (Squads multisig) each time a scheduled unlock
    /// date arrives. `current_drawdown_bps` is the attested drawdown-from-launch
    /// in basis points, sourced per the on-chain-oracle or off-chain-keeper path
    /// documented in vesting-circuit-breaker.md.
    pub fn evaluate_gate(ctx: Context<EvaluateGate>, current_drawdown_bps: u16) -> Result<()> {
        let gate = &mut ctx.accounts.gate;
        require_keys_eq!(ctx.accounts.authority.key(), gate.authority, VcbError::Unauthorized);

        let tier = if current_drawdown_bps < gate.healthy_drawdown_ceiling_bps {
            MarketHealthTier::Healthy
        } else if current_drawdown_bps < gate.watch_drawdown_ceiling_bps {
            MarketHealthTier::Watch
        } else {
            MarketHealthTier::Spiral
        };

        let release_bps: u64 = match tier {
            MarketHealthTier::Healthy => 10_000,
            MarketHealthTier::Watch => gate.watch_tier_release_bps as u64,
            MarketHealthTier::Spiral => gate.spiral_tier_release_bps as u64,
        };

        let total = gate.scheduled_unlock_amount;
        let released = total
            .checked_mul(release_bps)
            .ok_or(VcbError::ArithmeticOverflow)?
            .checked_div(10_000)
            .ok_or(VcbError::ArithmeticOverflow)?;
        let deferred = total.checked_sub(released).ok_or(VcbError::ArithmeticOverflow)?;

        if deferred > 0 && gate.deferred_since == 0 {
            gate.deferred_since = Clock::get()?.unix_timestamp;
        }

        gate.deferred_amount = gate
            .deferred_amount
            .checked_add(deferred)
            .ok_or(VcbError::ArithmeticOverflow)?;

        gate.consecutive_gated_events = if matches!(tier, MarketHealthTier::Healthy) {
            0
        } else {
            gate.consecutive_gated_events.saturating_add(1)
        };

        emit!(VestingGateEvaluated {
            gate: gate.key(),
            tier: tier as u8,
            released_amount: released,
            deferred_amount: deferred,
            total_deferred_outstanding: gate.deferred_amount,
            consecutive_gated_events: gate.consecutive_gated_events,
            timestamp: Clock::get()?.unix_timestamp,
        });

        // Escalation signal — mirrors ecosystem-signals.md's VESTING_REPEATEDLY_GATED.
        // Emitted as a distinct event so an off-chain indexer can route it to
        // Incident Response without re-deriving the threshold logic.
        if gate.consecutive_gated_events >= 2 {
            emit!(VestingRepeatedlyGated {
                gate: gate.key(),
                consecutive_gated_events: gate.consecutive_gated_events,
                timestamp: Clock::get()?.unix_timestamp,
            });
        }

        Ok(())
    }

    /// Permissionless — anyone can trigger release of matured deferred tokens
    /// once max_deferral_seconds has elapsed since deferral began. This is the
    /// hard ceiling promised in vesting-circuit-breaker.md: recipients are never
    /// left in indefinite limbo regardless of ongoing market conditions.
    pub fn release_matured_deferral(ctx: Context<ReleaseMaturedDeferral>) -> Result<()> {
        let gate = &mut ctx.accounts.gate;
        require!(gate.deferred_amount > 0, VcbError::NothingDeferred);
        require!(gate.deferred_since > 0, VcbError::NothingDeferred);

        let now = Clock::get()?.unix_timestamp;
        let matured = now
            .checked_sub(gate.deferred_since)
            .ok_or(VcbError::ArithmeticOverflow)?
            >= gate.max_deferral_seconds;
        require!(matured, VcbError::DeferralNotYetMatured);

        let amount = gate.deferred_amount;
        gate.deferred_amount = 0;
        gate.deferred_since = 0;

        emit!(DeferredVestingReleased {
            gate: gate.key(),
            amount,
            timestamp: now,
        });

        // NOTE: actual SPL token transfer CPI to the recipient's vesting escrow
        // is intentionally left to the integrating team's existing Streamflow/
        // custom vesting contract — this program tracks the health-gate
        // accounting; token custody stays wherever tokenomics-design.md already
        // put it. Wire the transfer CPI here before mainnet use.
        Ok(())
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum MarketHealthTier {
    Healthy = 0,
    Watch = 1,
    Spiral = 2,
}

#[account]
pub struct VestingGate {
    pub authority: Pubkey,                  // Squads v4 multisig PDA — see wallet-tge-security.md
    pub healthy_drawdown_ceiling_bps: u16,
    pub watch_drawdown_ceiling_bps: u16,
    pub watch_tier_release_bps: u16,
    pub spiral_tier_release_bps: u16,
    pub max_deferral_seconds: i64,
    pub scheduled_unlock_amount: u64,
    pub deferred_amount: u64,
    pub deferred_since: i64,                // 0 = nothing currently deferred
    pub consecutive_gated_events: u32,
    pub bump: u8,
}

impl VestingGate {
    pub const SIZE: usize = 8   // discriminator
        + 32                     // authority
        + 2 * 4                  // 4x u16
        + 8                       // max_deferral_seconds
        + 8                       // scheduled_unlock_amount
        + 8                       // deferred_amount
        + 8                       // deferred_since
        + 4                       // consecutive_gated_events
        + 1;                      // bump
}

#[derive(Accounts)]
pub struct InitializeGate<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = VestingGate::SIZE,
        seeds = [b"vesting-gate", authority.key().as_ref()],
        bump
    )]
    pub gate: Account<'info, VestingGate>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct EvaluateGate<'info> {
    pub authority: Signer<'info>,

    #[account(mut, seeds = [b"vesting-gate", gate.authority.as_ref()], bump = gate.bump)]
    pub gate: Account<'info, VestingGate>,
}

#[derive(Accounts)]
pub struct ReleaseMaturedDeferral<'info> {
    #[account(mut, seeds = [b"vesting-gate", gate.authority.as_ref()], bump = gate.bump)]
    pub gate: Account<'info, VestingGate>,
}

#[event]
pub struct VestingGateEvaluated {
    pub gate: Pubkey,
    pub tier: u8,
    pub released_amount: u64,
    pub deferred_amount: u64,
    pub total_deferred_outstanding: u64,
    pub consecutive_gated_events: u32,
    pub timestamp: i64,
}

#[event]
pub struct VestingRepeatedlyGated {
    pub gate: Pubkey,
    pub consecutive_gated_events: u32,
    pub timestamp: i64,
}

#[event]
pub struct DeferredVestingReleased {
    pub gate: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[error_code]
pub enum VcbError {
    #[msg("healthy_drawdown_ceiling_bps must be less than watch_drawdown_ceiling_bps")]
    InvalidThresholdOrdering,
    #[msg("basis-point value must be <= 10000")]
    InvalidBps,
    #[msg("spiral_tier_release_bps must be <= watch_tier_release_bps — a worse market tier cannot release more than a milder one")]
    InvalidTierOrdering,
    #[msg("max_deferral_seconds must be positive")]
    InvalidDeferralWindow,
    #[msg("only the gate authority (Squads multisig) may evaluate the gate")]
    Unauthorized,
    #[msg("arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("no deferred amount outstanding")]
    NothingDeferred,
    #[msg("deferral window has not yet elapsed")]
    DeferralNotYetMatured,
}
