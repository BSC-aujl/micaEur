use anchor_lang::prelude::*;
use crate::error::MicaEurError;
use crate::constants::*;

/// KYC status enum
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum KycStatus {
    Unverified,
    Pending,
    Verified,
    Rejected,
    Expired,
    Suspended,
}

/// KYC user information
#[account]
pub struct KycUser {
    pub authority: Pubkey,           // Authority that can update the KYC status
    pub user: Pubkey,                // User wallet address
    pub status: KycStatus,           // Current KYC status
    pub verification_level: u8,      // Level of verification (0-3)
    pub verification_time: i64,      // When the verification was last updated
    pub expiry_time: i64,            // When the verification expires
    pub country_code: String,        // ISO country code
    pub blz: String,                 // Bank code (Bankleitzahl)
    pub iban_hash: [u8; 32],         // SHA-256 hash of the IBAN
    pub verification_provider: String, // Which provider verified the KYC
}

/// KYC Oracle state
#[account]
pub struct KycOracleState {
    pub authority: Pubkey,           // Authority that can update the KYC oracle
    pub user_count: u64,             // Count of registered users
    pub verified_user_count: u64,    // Count of verified users
    pub last_update_time: i64,       // When the oracle was last updated
}

#[derive(Accounts)]
pub struct InitializeKycOracle<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        init,
        payer = authority,
        seeds = [KYC_ORACLE_STATE_SEED],
        bump,
        space = 8 + std::mem::size_of::<KycOracleState>(),
    )]
    pub kyc_oracle_state: Account<'info, KycOracleState>,
    
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct RegisterKycUser<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        seeds = [KYC_ORACLE_STATE_SEED],
        bump,
        constraint = kyc_oracle_state.authority == authority.key(),
    )]
    pub kyc_oracle_state: Account<'info, KycOracleState>,
    
    /// The wallet of the user to register
    /// CHECK: Just recording the public key
    pub user: UncheckedAccount<'info>,
    
    #[account(
        init,
        payer = authority,
        seeds = [KYC_USER_SEED, user.key().as_ref()],
        bump,
        space = 8 + std::mem::size_of::<KycUser>() + 100, // extra space for strings
    )]
    pub kyc_user: Account<'info, KycUser>,
    
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct UpdateKycStatus<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        seeds = [KYC_ORACLE_STATE_SEED],
        bump,
        constraint = kyc_oracle_state.authority == authority.key(),
    )]
    pub kyc_oracle_state: Account<'info, KycOracleState>,
    
    #[account(
        mut,
        seeds = [KYC_USER_SEED, kyc_user.user.as_ref()],
        bump,
        constraint = kyc_user.authority == authority.key(),
    )]
    pub kyc_user: Account<'info, KycUser>,
}

// Initialize KYC Oracle
pub fn initialize_kyc_oracle(ctx: Context<InitializeKycOracle>) -> Result<()> {
    let kyc_oracle_state = &mut ctx.accounts.kyc_oracle_state;
    kyc_oracle_state.authority = ctx.accounts.authority.key();
    kyc_oracle_state.user_count = 0;
    kyc_oracle_state.verified_user_count = 0;
    kyc_oracle_state.last_update_time = Clock::get()?.unix_timestamp;
    
    msg!("KYC Oracle initialized");
    msg!("Authority: {}", kyc_oracle_state.authority);
    Ok(())
}

// Register a user for KYC
pub fn register_kyc_user(
    ctx: Context<RegisterKycUser>,
    blz: String,
    iban_hash: [u8; 32],
    country_code: String,
    verification_provider: String,
) -> Result<()> {
    // Validate country code
    if country_code.len() != 2 {
        return Err(MicaEurError::InvalidCountryCode.into());
    }

    // Check if country is supported
    if !is_country_supported(&country_code) {
        return Err(MicaEurError::UnsupportedCountry.into());
    }

    // Initialize the KYC user
    let kyc_user = &mut ctx.accounts.kyc_user;
    let kyc_oracle_state = &mut ctx.accounts.kyc_oracle_state;
    
    kyc_user.authority = ctx.accounts.authority.key();
    kyc_user.user = ctx.accounts.user.key();
    kyc_user.status = KycStatus::Pending;
    kyc_user.verification_level = 0;
    kyc_user.verification_time = Clock::get()?.unix_timestamp;
    kyc_user.expiry_time = 0; // Not verified yet
    kyc_user.country_code = country_code;
    kyc_user.blz = blz;
    kyc_user.iban_hash = iban_hash;
    kyc_user.verification_provider = verification_provider;
    
    // Update oracle state
    kyc_oracle_state.user_count += 1;
    kyc_oracle_state.last_update_time = Clock::get()?.unix_timestamp;
    
    msg!("User registered for KYC verification: {}", kyc_user.user);
    msg!("Country code: {}", kyc_user.country_code);
    Ok(())
}

// Update KYC status for a user
pub fn update_kyc_status(
    ctx: Context<UpdateKycStatus>,
    status: KycStatus,
    verification_level: u8,
    expiry_days: i64,
) -> Result<()> {
    // Validate verification level (0-3)
    if verification_level > 3 {
        return Err(MicaEurError::InvalidVerificationLevel.into());
    }
    
    // Validate expiry days (must be positive if status is Verified)
    if status == KycStatus::Verified && expiry_days <= 0 {
        return Err(MicaEurError::InvalidExpiryDate.into());
    }
    
    let kyc_user = &mut ctx.accounts.kyc_user;
    let kyc_oracle_state = &mut ctx.accounts.kyc_oracle_state;
    let clock = Clock::get()?;
    
    // Update the user status
    let was_verified = kyc_user.status == KycStatus::Verified;
    kyc_user.status = status;
    kyc_user.verification_level = verification_level;
    kyc_user.verification_time = clock.unix_timestamp;
    
    // Calculate expiry time if status is Verified
    if status == KycStatus::Verified {
        kyc_user.expiry_time = clock.unix_timestamp + (expiry_days * 86400);
        
        // If this is a new verification, increment the verified count
        if !was_verified {
            kyc_oracle_state.verified_user_count += 1;
        }
    } else if was_verified {
        // If user was verified but is no longer, decrement the count
        kyc_oracle_state.verified_user_count = kyc_oracle_state.verified_user_count.saturating_sub(1);
    }
    
    // Update oracle state
    kyc_oracle_state.last_update_time = clock.unix_timestamp;
    
    msg!("Updated KYC status for user: {}", kyc_user.user);
    msg!("New status: {:?}", kyc_user.status);
    msg!("Verification level: {}", kyc_user.verification_level);
    
    if status == KycStatus::Verified {
        msg!("Expires on: {}", kyc_user.expiry_time);
    }
    
    Ok(())
}

// Helper function to check if a user is KYC verified
pub fn is_kyc_verified(kyc_user: &KycUser) -> bool {
    if kyc_user.status != KycStatus::Verified {
        return false;
    }
    
    // Check if verification has expired
    let current_time = Clock::get().unwrap().unix_timestamp;
    if kyc_user.expiry_time > 0 && current_time > kyc_user.expiry_time {
        return false;
    }
    
    true
} 