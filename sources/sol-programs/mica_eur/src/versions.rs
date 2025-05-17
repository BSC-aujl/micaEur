use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_pack::Pack;

/// Program version
pub const PROGRAM_VERSION: &str = "0.1.0";
/// Minimum compatible Solana version
pub const MIN_SOLANA_VERSION: &str = "1.16.0";

/// Log the program and Solana versions
pub fn log_versions() {
    msg!("Program Version: {}", PROGRAM_VERSION);
    msg!("Compatible with Solana Version: >= {}", MIN_SOLANA_VERSION);
}

/// Check if the Solana version is compatible
pub fn is_solana_version_compatible() -> bool {
    // In a real implementation, this would check the actual Solana version
    // For now, we just return true
    true
}

/// Get the program version
pub fn get_program_version() -> &'static str {
    PROGRAM_VERSION
} 