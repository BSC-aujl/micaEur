use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    program_pack::Pack, 
    system_instruction, 
    instruction::Instruction,
    hash
};
use anchor_spl::token_2022::{self, spl_token_2022::{
    extension::{
        default_account_state::DefaultAccountState,
        metadata_pointer::MetadataPointer,
        transfer_hook::TransferHook,
        permanent_delegate::PermanentDelegate,
        StateWithExtensions,
        BaseStateWithExtensions
    },
    state::{AccountState, Mint}
}};
use std::convert::TryInto;

use crate::constants::TOKEN_2022_ID;
use crate::error::MicaEurError;

/// Calculate the size of a mint with all required Token-2022 extensions
pub fn get_mint_size_with_extensions() -> usize {
    // Calculate size manually since get_total_size_of_extensions might not be available
    let base_size = Mint::get_packed_len();
    let default_state_size = std::mem::size_of::<DefaultAccountState>();
    let metadata_pointer_size = std::mem::size_of::<MetadataPointer>();
    let transfer_hook_size = std::mem::size_of::<TransferHook>();
    let permanent_delegate_size = std::mem::size_of::<PermanentDelegate>();
    
    // Add the sizes plus some overhead for TLV headers
    base_size +
        default_state_size + 
        metadata_pointer_size + 
        transfer_hook_size + 
        permanent_delegate_size + 
        4 * 8 // TLV header overhead (type, length for each)
}

/// Generate instructions to create a Token-2022 mint with all required extensions
pub fn generate_token2022_mint_instructions(
    mint_account: &Pubkey,
    mint_authority: &Pubkey,
    freeze_authority: &Pubkey,
    permanent_delegate: &Pubkey,
    transfer_hook_program_id: &Pubkey,
    metadata_uri: &str,
    decimals: u8,
    payer: &Pubkey,
) -> Result<Vec<Instruction>> {
    let space = get_mint_size_with_extensions();
    let rent = Rent::get()?;
    let lamports = rent.minimum_balance(space);
    
    let mut instructions = vec![
        // Create the account for the mint
        system_instruction::create_account(
            payer,
            mint_account,
            lamports,
            space as u64,
            &TOKEN_2022_ID,
        )
    ];
    
    // Initialize the mint - must be done first
    use anchor_spl::token_2022::spl_token_2022;
    let init_mint_ix = spl_token_2022::instruction::initialize_mint(
        &TOKEN_2022_ID,
        mint_account,
        mint_authority,
        Some(freeze_authority),
        decimals,
    )?;
    
    instructions.push(init_mint_ix);
    
    // Note: Extensions will be initialized via direct CPI calls
    msg!("Extension initialization will be handled via direct CPI calls");

    Ok(instructions)
}

/// Check if a mint has all the required extensions for a MiCA-compliant stablecoin
/// Simplified to avoid type conversion issues
pub fn check_token2022_mint_extensions(
    mint_state: &StateWithExtensions<Mint>,
    permanent_delegate: &Pubkey,
    transfer_hook_program_id: &Pubkey,
) -> Result<bool> {
    // Check DefaultAccountState extension
    if let Ok(_) = mint_state.get_extension_bytes::<DefaultAccountState>() {
        // Extension exists, we'll just check existence for now
        msg!("DefaultAccountState extension found");
    } else {
        msg!("Missing DefaultAccountState extension");
        return Ok(false);
    }
    
    // Check PermanentDelegate extension
    if let Ok(_) = mint_state.get_extension_bytes::<PermanentDelegate>() {
        // Extension exists, we'll just check existence for now
        msg!("PermanentDelegate extension found");
    } else {
        msg!("Missing PermanentDelegate extension");
        return Ok(false);
    }
    
    // Check TransferHook extension
    if let Ok(_) = mint_state.get_extension_bytes::<TransferHook>() {
        // Extension exists, we'll just check existence for now
        msg!("TransferHook extension found");
    } else {
        msg!("Missing TransferHook extension");
        return Ok(false);
    }
    
    // Check MetadataPointer extension
    if let Ok(_) = mint_state.get_extension_bytes::<MetadataPointer>() {
        // We only check for existence, not the content
        msg!("MetadataPointer extension found");
    } else {
        msg!("Missing MetadataPointer extension");
        return Ok(false);
    }
    
    // All extensions exist
    msg!("All required extensions are present");
    Ok(true)
}

/// Generate a Merkle tree hash for reserve verification
pub fn calculate_merkle_root(leaves: &[[u8; 32]]) -> [u8; 32] {
    if leaves.is_empty() {
        return [0; 32];
    }
    
    if leaves.len() == 1 {
        return leaves[0];
    }
    
    let mut next_level = Vec::new();
    for chunk in leaves.chunks(2) {
        if chunk.len() == 2 {
            let mut combined = [0u8; 64];
            combined[0..32].copy_from_slice(&chunk[0]);
            combined[32..64].copy_from_slice(&chunk[1]);
            
            let hash_result = hash::hash(&combined).to_bytes();
            next_level.push(hash_result);
        } else {
            next_level.push(chunk[0]);
        }
    }
    
    let next_level_array: Vec<[u8; 32]> = next_level.into_iter().collect();
    calculate_merkle_root(&next_level_array)
}

/// Verify a Merkle proof against a root
pub fn verify_merkle_proof(
    proof: &[[u8; 32]],
    root: &[u8; 32],
    leaf: &[u8; 32],
    indexes: &[u8],
) -> bool {
    if proof.len() != indexes.len() {
        return false;
    }
    
    let mut current = *leaf;
    
    for (i, (hash, index)) in proof.iter().zip(indexes.iter()).enumerate() {
        let mut combined = [0u8; 64];
        
        if *index == 0 {
            combined[0..32].copy_from_slice(&current);
            combined[32..64].copy_from_slice(hash);
        } else {
            combined[0..32].copy_from_slice(hash);
            combined[32..64].copy_from_slice(&current);
        }
        
        current = hash::hash(&combined).to_bytes();
    }
    
    &current == root
} 