use anchor_lang::prelude::*;
use crate::constants::KYC_ORACLE_SEED;

// KYC status enum
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum KycStatus {
    Unverified,
    Pending,
    Verified,
    Rejected,
}

// User KYC information
#[account]
pub struct KycUser {
    pub authority: Pubkey,         // Authority that can update this KYC record
    pub user: Pubkey,              // User's wallet address
    pub status: KycStatus,         // Current KYC status
    pub blz: String,               // German Bankleitzahl (Bank Sorting Code)
    pub iban_hash: [u8; 32],       // Hash of the IBAN (for privacy)
    pub verification_date: i64,    // Timestamp of verification
    pub expiry_date: i64,          // Expiry of KYC verification
    pub verification_level: u8,    // Level of verification (1=basic, 2=enhanced)
    pub country_code: String,      // ISO country code (e.g., "DE" for Germany)
    pub verification_provider: String, // Which identity verification provider was used
}

// KYC Oracle state to manage the program
#[account]
pub struct KycOracleState {
    pub authority: Pubkey,         // Authority that can manage the oracle
    pub is_active: bool,           // Whether the oracle is active
    pub admin_count: u8,           // Number of admins
    pub total_verified_users: u64, // Total number of verified users
    pub last_update: i64,          // Last update timestamp
}

// Instructions for the KYC Oracle
#[derive(Accounts)]
pub struct InitializeKycOracle<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + std::mem::size_of::<KycOracleState>(),
    )]
    pub oracle_state: Account<'info, KycOracleState>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterKycUser<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        constraint = oracle_state.authority == authority.key() || oracle_state.is_active
    )]
    pub oracle_state: Account<'info, KycOracleState>,
    
    pub user: SystemAccount<'info>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + std::mem::size_of::<KycUser>() + 200, // Extra space for strings
    )]
    pub kyc_user: Account<'info, KycUser>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateKycStatus<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        seeds = [KYC_ORACLE_SEED],
        bump,
        constraint = oracle_state.authority == authority.key()
            @ ProgramError::InvalidAccountData,
        constraint = oracle_state.is_active
            @ ProgramError::InvalidAccountData
    )]
    pub oracle_state: Account<'info, KycOracleState>,
    
    #[account(
        mut,
        constraint = kyc_user.authority == authority.key()
    )]
    pub kyc_user: Account<'info, KycUser>,
}

// KYC Oracle methods implementation
pub fn initialize_kyc_oracle(ctx: Context<InitializeKycOracle>) -> Result<()> {
    let oracle_state = &mut ctx.accounts.oracle_state;
    oracle_state.authority = ctx.accounts.authority.key();
    oracle_state.is_active = true;
    oracle_state.admin_count = 1;
    oracle_state.total_verified_users = 0;
    oracle_state.last_update = Clock::get()?.unix_timestamp;
    
    msg!("KYC Oracle initialized successfully");
    Ok(())
}

pub fn register_kyc_user(
    ctx: Context<RegisterKycUser>,
    blz: String,
    iban_hash: [u8; 32],
    country_code: String,
    verification_provider: String,
) -> Result<()> {
    let kyc_user = &mut ctx.accounts.kyc_user;
    let oracle_state = &mut ctx.accounts.oracle_state;
    
    kyc_user.authority = ctx.accounts.authority.key();
    kyc_user.user = ctx.accounts.user.key();
    kyc_user.status = KycStatus::Pending;
    kyc_user.blz = blz;
    kyc_user.iban_hash = iban_hash;
    kyc_user.verification_date = 0; // Not verified yet
    kyc_user.expiry_date = 0; // Not set yet
    kyc_user.verification_level = 0; // Not set yet
    kyc_user.country_code = country_code;
    kyc_user.verification_provider = verification_provider;
    
    oracle_state.last_update = Clock::get()?.unix_timestamp;
    
    msg!("KYC user registered successfully, status: Pending");
    Ok(())
}

pub fn update_kyc_status(
    ctx: Context<UpdateKycStatus>,
    status: KycStatus,
    verification_level: u8,
    expiry_days: i64,
) -> Result<()> {
    let kyc_user = &mut ctx.accounts.kyc_user;
    let oracle_state = &mut ctx.accounts.oracle_state;
    let current_time = Clock::get()?.unix_timestamp;
    
    kyc_user.status = status;
    kyc_user.verification_date = current_time;
    kyc_user.verification_level = verification_level;
    
    // Set expiry date if provided, otherwise default to 1 year
    if expiry_days > 0 {
        kyc_user.expiry_date = current_time + (expiry_days * 86400); // seconds in a day
    } else {
        kyc_user.expiry_date = current_time + (365 * 86400); // default 1 year
    }
    
    // If status changed to verified, update total count
    if status == KycStatus::Verified && kyc_user.status != KycStatus::Verified {
        oracle_state.total_verified_users += 1;
    }
    
    oracle_state.last_update = current_time;
    
    msg!("KYC status updated to: {:?}, verification level: {}", status, verification_level);
    Ok(())
}

// Utility functions for KYC verification
pub fn is_kyc_verified(kyc_user: &KycUser) -> bool {
    let current_time = Clock::get().unwrap().unix_timestamp;
    
    kyc_user.status == KycStatus::Verified && 
    kyc_user.verification_level > 0 &&
    current_time < kyc_user.expiry_date
}

// Check if a user meets MiCA compliance requirements
pub fn meets_mica_requirements(
    kyc_user: &KycUser, 
    required_level: u8,
    required_country_codes: &[&str]
) -> bool {
    if !is_kyc_verified(kyc_user) {
        return false;
    }
    
    // Check verification level meets minimum requirement
    if kyc_user.verification_level < required_level {
        return false;
    }
    
    // Check if user's country is in the allowed list
    let user_country = kyc_user.country_code.as_str();
    required_country_codes.contains(&user_country)
} 