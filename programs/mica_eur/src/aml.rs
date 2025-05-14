use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::MicaEurError;

/// Bit-flags representing the powers an AML authority can have.
/// These can be combined in a single `u8` bit-field so they are cheap to store on-chain.
pub mod aml_powers {
    pub const VIEW_TRANSACTIONS: u8 = 1 << 0;
    pub const FREEZE_ACCOUNTS: u8 = 1 << 1;
    pub const SEIZE_FUNDS: u8 = 1 << 2;
    pub const MODIFY_BLACKLIST: u8 = 1 << 3;
}

/// Account that represents an AML authority registered with the issuer / regulator.
#[account]
pub struct AmlAuthority {
    pub authority: Pubkey,    // Signer that controls this record
    pub authority_id: String, // External identifier e.g. LEI / registration number
    pub powers: u8,           // Bitfield of powers (see `aml_powers`)
    pub is_active: bool,      // Whether the authority is active
    pub creation_time: i64,   // When the record was created
    pub last_action_time: i64,// Last time the authority performed an on-chain AML action
}

impl AmlAuthority {
    pub fn has_power(&self, power_flag: u8) -> bool {
        (self.powers & power_flag) != 0
    }
}

/// Account that represents a blacklist entry created by an AML authority.
#[account]
pub struct BlacklistEntry {
    pub user: Pubkey,         // User address that is blacklisted
    pub authority: Pubkey,    // AML authority that created this entry
    pub reason: u8,           // Application-specific reason code
    pub is_active: bool,      // Whether entry is currently active
    pub creation_time: i64,   // When the entry was created
}

// ---------------- Instruction handlers ----------------

/// Register a new AML authority.
pub fn register_aml_authority(
    ctx: Context<crate::mica_eur::RegisterAmlAuthority>,
    authority_id: String,
    powers: u8,
) -> Result<()> {
    let aml_authority = &mut ctx.accounts.aml_authority;

    // Populate account
    aml_authority.authority = ctx.accounts.authority.key();
    aml_authority.authority_id = authority_id;
    aml_authority.powers = powers;
    aml_authority.is_active = true;
    aml_authority.creation_time = Clock::get()?.unix_timestamp;
    aml_authority.last_action_time = aml_authority.creation_time;

    msg!("Registered new AML authority: {}", aml_authority.authority);
    Ok(())
}

/// Create or update a blacklist entry for a given user.
pub fn create_blacklist_entry(
    ctx: Context<crate::mica_eur::CreateBlacklistEntry>,
    reason: u8,
) -> Result<()> {
    let aml_authority = &mut ctx.accounts.aml_authority;

    // Check that AML authority is active and has correct power
    if !aml_authority.is_active {
        return Err(MicaEurError::AmlAuthorityInactive.into());
    }
    if !aml_authority.has_power(aml_powers::MODIFY_BLACKLIST) {
        return Err(MicaEurError::UnauthorizedAmlAuthority.into());
    }

    let blacklist_entry = &mut ctx.accounts.blacklist_entry;

    // Populate blacklist entry
    blacklist_entry.user = ctx.accounts.user.key();
    blacklist_entry.authority = aml_authority.authority;
    blacklist_entry.reason = reason;
    blacklist_entry.is_active = true;
    blacklist_entry.creation_time = Clock::get()?.unix_timestamp;

    // Update last action time on AML authority
    aml_authority.last_action_time = blacklist_entry.creation_time;

    msg!(
        "Blacklisted user {} by AML authority {}",
        blacklist_entry.user,
        blacklist_entry.authority
    );
    Ok(())
}

/// Deactivate an AML authority (issuer or regulator only)
pub fn deactivate_aml_authority(
    ctx: Context<crate::mica_eur::DeactivateAmlAuthority>,
) -> Result<()> {
    let aml_authority = &mut ctx.accounts.aml_authority;
    aml_authority.is_active = false;
    aml_authority.last_action_time = Clock::get()?.unix_timestamp;
    msg!("Deactivated AML authority: {}", aml_authority.authority);
    Ok(())
}

/// Deactivate (un-blacklist) a blacklist entry (AML authority only)
pub fn deactivate_blacklist_entry(
    ctx: Context<crate::mica_eur::DeactivateBlacklistEntry>,
) -> Result<()> {
    let aml_authority = &ctx.accounts.aml_authority;
    let blacklist_entry = &mut ctx.accounts.blacklist_entry;
    if !aml_authority.is_active {
        return Err(MicaEurError::AmlAuthorityInactive.into());
    }
    if !aml_authority.has_power(aml_powers::MODIFY_BLACKLIST) {
        return Err(MicaEurError::UnauthorizedAmlAuthority.into());
    }
    blacklist_entry.is_active = false;
    msg!("Blacklist entry for user {} deactivated by AML authority {}", blacklist_entry.user, aml_authority.authority);
    Ok(())
}

/// Update the powers of an AML authority (issuer or regulator only)
pub fn update_aml_authority_powers(
    ctx: Context<crate::mica_eur::UpdateAmlAuthorityPowers>,
    new_powers: u8,
) -> Result<()> {
    let aml_authority = &mut ctx.accounts.aml_authority;
    aml_authority.powers = new_powers;
    aml_authority.last_action_time = Clock::get()?.unix_timestamp;
    msg!("Updated powers for AML authority: {}", aml_authority.authority);
    Ok(())
}

// Context struct definitions for RegisterAmlAuthority and CreateBlacklistEntry are moved into the program module in lib.rs 