use anchor_lang::prelude::*;
use anchor_lang::system_program;
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
        ExtensionType,
        StateWithExtensions,
    },
    state::{AccountState, Mint},
    instruction::{
        initialize_mint, 
        initialize_permanent_delegate, 
        initialize_default_account_state, 
        initialize_metadata_pointer, 
        initialize_transfer_hook,
    },
    ID as TOKEN_2022_ID,
}};
use std::convert::TryInto;

use crate::constants::*;
use crate::versions;

/// Calculate the size of a mint with all required Token-2022 extensions
pub fn get_mint_size_with_extensions() -> usize {
    let extensions = vec![
        ExtensionType::DefaultAccountState,
        ExtensionType::MetadataPointer,
        ExtensionType::TransferHook,
        ExtensionType::PermanentDelegate,
    ];
    
    Mint::get_packed_len() + ExtensionType::get_total_size_of_extensions(&extensions)
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
        ),
        
        // Initialize the DefaultAccountState extension (all accounts frozen by default)
        initialize_default_account_state(
            &TOKEN_2022_ID,
            mint_account,
            &AccountState::Frozen,
        )?,
        
        // Initialize the PermanentDelegate extension
        initialize_permanent_delegate(
            &TOKEN_2022_ID,
            mint_account,
            permanent_delegate,
        )?,
        
        // Initialize the TransferHook extension
        initialize_transfer_hook(
            &TOKEN_2022_ID,
            mint_account,
            transfer_hook_program_id,
            None, // Use default authority (= mint_authority)
        )?,
        
        // Initialize the MetadataPointer extension
        initialize_metadata_pointer(
            &TOKEN_2022_ID,
            mint_account,
            &mint_authority,
            &metadata_uri,
        )?,
        
        // Initialize the mint
        initialize_mint(
            &TOKEN_2022_ID,
            mint_account,
            mint_authority,
            Some(freeze_authority),
            decimals,
        )?,
    ];

    Ok(instructions)
}

/// Check if a mint has all the required extensions for a MiCA-compliant stablecoin
pub fn check_token2022_mint_extensions(
    mint_state: &StateWithExtensions<Mint>,
    permanent_delegate: &Pubkey,
    transfer_hook_program_id: &Pubkey,
) -> Result<bool> {
    // Check DefaultAccountState extension
    if let Ok(default_state) = mint_state.get_extension::<DefaultAccountState>() {
        if default_state.state != AccountState::Frozen as u8 {
            msg!("DefaultAccountState must be Frozen");
            return Ok(false);
        }
    } else {
        msg!("Missing DefaultAccountState extension");
        return Ok(false);
    }
    
    // Check PermanentDelegate extension
    if let Ok(delegate) = mint_state.get_extension::<PermanentDelegate>() {
        let delegate_pubkey = Pubkey::from(delegate.delegate);
        if &delegate_pubkey != permanent_delegate {
            msg!("PermanentDelegate does not match expected authority");
            return Ok(false);
        }
    } else {
        msg!("Missing PermanentDelegate extension");
        return Ok(false);
    }
    
    // Check TransferHook extension
    if let Ok(hook) = mint_state.get_extension::<TransferHook>() {
        let hook_program_id = Pubkey::from(hook.program_id);
        if &hook_program_id != transfer_hook_program_id {
            msg!("TransferHook does not match expected program ID");
            return Ok(false);
        }
    } else {
        msg!("Missing TransferHook extension");
        return Ok(false);
    }
    
    // Check MetadataPointer extension
    if let Ok(_) = mint_state.get_extension::<MetadataPointer>() {
        // We only check for existence, not the content
    } else {
        msg!("Missing MetadataPointer extension");
        return Ok(false);
    }
    
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