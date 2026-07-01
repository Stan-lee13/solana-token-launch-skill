//! Programmatic Stabilization Vault (PSV)
//!
//! A disclosed, on-chain, mechanically-bounded buyback vault — a Solana port
//! of the TradFi greenshoe/over-allotment option. See
//! skill/stabilization-vault.md for the full design rationale.
//!
//! IMPORTANT — read before deploying: `execute_buyback` takes `current_drawdown_bps`
//! as a keeper-signed argument, same trust model as vesting-circuit-breaker.md.
//! The keeper authority MUST be a Squads v4 multisig PDA. The actual DEX swap
//! (buying the token with vault USDC/SOL) is left as a CPI stub — wire it to
//! your chosen AMM (Meteora DLMM / Orca Whirlpool per liquidity-seeding.md)
//! before mainnet use. This program enforces the bounds (cooldown, per-trigger
//! cap, lifetime cap) that make the mechanism defensible; it does not by
//! itself execute the swap.

use anchor_lang::prelude::*;

declare_id!("PSVauLtF7XQ2vgD5hT8m7ynACD5D9GvHXwEQ4pMLdcc");

#[program]
pub mod stabilization_vault {
    use super::*;

    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        total_allocated: u64,
        trigger_drawdown_bps: u16,
        max_single_buyback_bps: u16, // fraction of REMAINING vault, in bps
        cooldown_seconds: i64,
        max_buybacks_total: u16,
    ) -> Result<()> {
        require!(total_allocated > 0, PsvError::InvalidAllocation);
        require!(trigger_drawdown_bps > 0 && trigger_drawdown_bps <= 10_000, PsvError::InvalidBps);
        require!(
            max_single_buyback_bps > 0 && max_single_buyback_bps <= 10_000,
            PsvError::InvalidBps
        );
        require!(cooldown_seconds >= 0, PsvError::InvalidCooldown);
        require!(max_buybacks_total > 0, PsvError::InvalidBuybackCap);

        let vault = &mut ctx.accounts.vault;
        vault.authority = ctx.accounts.authority.key();
        vault.total_allocated = total_allocated;
        vault.remaining = total_allocated;
        vault.trigger_drawdown_bps = trigger_drawdown_bps;
        vault.max_single_buyback_bps = max_single_buyback_bps;
        vault.cooldown_seconds = cooldown_seconds;
        vault.max_buybacks_total = max_buybacks_total;
        vault.buybacks_executed = 0;
        vault.last_buyback_ts = 0;
        vault.bump = ctx.bumps.vault;
        Ok(())
    }

    /// Keeper-evaluated. Returns the bounded buyback amount and records the
    /// execution — every field here is a pure function of on-chain state and
    /// the disclosed config, with no discretionary branch. This is the entire
    /// difference between a defensible stabilization mechanism and market
    /// manipulation: anyone can independently recompute this and verify the
    /// vault only ever acted within its own disclosed rules.
    pub fn execute_buyback(ctx: Context<ExecuteBuyback>, current_drawdown_bps: u16) -> Result<u64> {
        let vault = &mut ctx.accounts.vault;
        require_keys_eq!(ctx.accounts.authority.key(), vault.authority, PsvError::Unauthorized);

        require!(
            vault.buybacks_executed < vault.max_buybacks_total,
            PsvError::LifetimeCapReached
        );
        require!(
            current_drawdown_bps >= vault.trigger_drawdown_bps,
            PsvError::BelowTriggerThreshold
        );

        let now = Clock::get()?.unix_timestamp;
        if vault.last_buyback_ts > 0 {
            let elapsed = now.checked_sub(vault.last_buyback_ts).ok_or(PsvError::ArithmeticOverflow)?;
            require!(elapsed >= vault.cooldown_seconds, PsvError::CooldownActive);
        }

        require!(vault.remaining > 0, PsvError::VaultDepleted);
        let buyback_amount = vault
            .remaining
            .checked_mul(vault.max_single_buyback_bps as u64)
            .ok_or(PsvError::ArithmeticOverflow)?
            .checked_div(10_000)
            .ok_or(PsvError::ArithmeticOverflow)?
            .max(1)
            .min(vault.remaining);

        vault.remaining = vault
            .remaining
            .checked_sub(buyback_amount)
            .ok_or(PsvError::ArithmeticOverflow)?;
        vault.buybacks_executed = vault.buybacks_executed.checked_add(1).ok_or(PsvError::ArithmeticOverflow)?;
        vault.last_buyback_ts = now;

        emit!(StabilizationTriggered {
            vault: vault.key(),
            drawdown_bps_at_trigger: current_drawdown_bps,
            buyback_amount,
            vault_remaining: vault.remaining,
            buybacks_executed: vault.buybacks_executed,
            buybacks_remaining: vault.max_buybacks_total - vault.buybacks_executed,
            timestamp: now,
        });

        // NOTE: the actual swap CPI (spend `buyback_amount` of vault-held
        // USDC/SOL to buy the project token on the configured AMM pool) is
        // intentionally left as an integration point — wire it to your
        // Meteora DLMM / Orca Whirlpool client per liquidity-seeding.md.
        // This instruction's job is enforcing the bounded, auditable
        // decision of HOW MUCH to buy back and WHEN; execution routing is
        // pool-specific and shouldn't be hardcoded into the trust-critical
        // bound-enforcement logic above.
        Ok(buyback_amount)
    }
}

#[account]
pub struct StabilizationVault {
    pub authority: Pubkey,           // Squads v4 multisig PDA — see wallet-tge-security.md
    pub total_allocated: u64,        // fixed at TGE, disclosed publicly
    pub remaining: u64,
    pub trigger_drawdown_bps: u16,
    pub max_single_buyback_bps: u16, // fraction of REMAINING vault per trigger
    pub cooldown_seconds: i64,
    pub max_buybacks_total: u16,
    pub buybacks_executed: u16,
    pub last_buyback_ts: i64,        // 0 = never triggered
    pub bump: u8,
}

impl StabilizationVault {
    pub const SIZE: usize = 8  // discriminator
        + 32                    // authority
        + 8                     // total_allocated
        + 8                     // remaining
        + 2                     // trigger_drawdown_bps
        + 2                     // max_single_buyback_bps
        + 8                     // cooldown_seconds
        + 2                     // max_buybacks_total
        + 2                     // buybacks_executed
        + 8                     // last_buyback_ts
        + 1;                    // bump
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = StabilizationVault::SIZE,
        seeds = [b"stabilization-vault", authority.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, StabilizationVault>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteBuyback<'info> {
    pub authority: Signer<'info>,

    #[account(mut, seeds = [b"stabilization-vault", vault.authority.as_ref()], bump = vault.bump)]
    pub vault: Account<'info, StabilizationVault>,
}

#[event]
pub struct StabilizationTriggered {
    pub vault: Pubkey,
    pub drawdown_bps_at_trigger: u16,
    pub buyback_amount: u64,
    pub vault_remaining: u64,
    pub buybacks_executed: u16,
    pub buybacks_remaining: u16,
    pub timestamp: i64,
}

#[error_code]
pub enum PsvError {
    #[msg("total_allocated must be > 0")]
    InvalidAllocation,
    #[msg("basis-point value out of range")]
    InvalidBps,
    #[msg("cooldown_seconds must be >= 0")]
    InvalidCooldown,
    #[msg("max_buybacks_total must be > 0")]
    InvalidBuybackCap,
    #[msg("only the vault authority (Squads multisig) may trigger buybacks")]
    Unauthorized,
    #[msg("lifetime buyback cap already reached")]
    LifetimeCapReached,
    #[msg("current drawdown is below the trigger threshold")]
    BelowTriggerThreshold,
    #[msg("cooldown period still active since last buyback")]
    CooldownActive,
    #[msg("vault has been fully depleted")]
    VaultDepleted,
    #[msg("arithmetic overflow")]
    ArithmeticOverflow,
}
