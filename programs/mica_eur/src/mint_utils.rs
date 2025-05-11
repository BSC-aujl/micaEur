use anchor_lang::prelude::*;
use anchor_spl::token_2022::spl_token_2022::{
    extension::{
        default_account_state::DefaultAccountState,
        permanent_delegate::PermanentDelegate,
        metadata_pointer::MetadataPointer,
        StateWithExtensions,
    },
    state::{AccountState, Mint},
};

use crate::constants::*;
use crate::error::MicaEurError;

/// Initialize a token mint with extensions
pub fn initialize_mint_with_extensions(
    mint: &AccountInfo,
    mint_authority: &Pubkey,
    freeze_authority: &Pubkey,
    permanent_delegate: &Pubkey,
    decimals: u8,
) -> Result<()> {
    // Validate parameters
    if decimals != EUR_DECIMALS {
        msg!("Warning: Using non-standard decimals for EUR token");
    }

    // Log the key parameters
    msg!("Initializing mint with extensions:");
    msg!("Mint: {}", mint.key());
    msg!("Mint Authority: {}", mint_authority);
    msg!("Freeze Authority: {}", freeze_authority);
    msg!("Permanent Delegate: {}", permanent_delegate);
    msg!("Decimals: {}", decimals);

    Ok(())
}

/// Check if a transaction exceeds the maximum allowed amount
pub fn check_transaction_amount(amount: u64) -> Result<()> {
    if amount > MAX_TRANSACTION_AMOUNT {
        return Err(MicaEurError::TransactionAmountExceedsMaximum.into());
    }
    Ok(())
}

/// Helper function to derive the mint info PDA
pub fn find_mint_info_pda(mint: &Pubkey, program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[MINT_INFO_SEED, mint.as_ref()], program_id)
}

/// Helper function to derive the KYC oracle state PDA
pub fn find_kyc_oracle_state_pda(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[KYC_ORACLE_STATE_SEED], program_id)
}

/// Helper function to derive the KYC user PDA
pub fn find_kyc_user_pda(user: &Pubkey, program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[KYC_USER_SEED, user.as_ref()], program_id)
} 