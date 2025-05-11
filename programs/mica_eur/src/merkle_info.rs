use anchor_lang::{
    prelude::*,
    solana_program::hash,
};

/// Calculate the hash of a Merkle tree node from its children
fn hash_node(left: &[u8; 32], right: &[u8; 32]) -> [u8; 32] {
    let mut combined = [0u8; 64];
    combined[0..32].copy_from_slice(left);
    combined[32..64].copy_from_slice(right);
    hash::hash(&combined).to_bytes()
}

/// Calculate a Merkle root from a set of leaves
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
            next_level.push(hash_node(&chunk[0], &chunk[1]));
        } else {
            next_level.push(chunk[0]);
        }
    }
    
    calculate_merkle_root(&next_level)
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

/// Create a leaf for the reserve Merkle tree
pub fn create_reserve_leaf(
    deposit_id: &str,
    amount: u64,
    timestamp: i64,
) -> [u8; 32] {
    let mut data = Vec::new();
    data.extend_from_slice(deposit_id.as_bytes());
    data.extend_from_slice(&amount.to_le_bytes());
    data.extend_from_slice(&timestamp.to_le_bytes());
    
    hash::hash(&data).to_bytes()
} 