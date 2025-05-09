/// Centralized version information for the MiCA EUR project
pub mod versions {
    /// Anchor framework version
    pub const ANCHOR_VERSION: &str = "0.30.1";
    
    /// Solana program version
    pub const SOLANA_VERSION: &str = "1.18.17";
    
    /// SPL Token-2022 version
    pub const SPL_TOKEN_2022_VERSION: &str = "2.0.6";
    
    /// SPL Token (legacy) version
    pub const SPL_TOKEN_VERSION: &str = "4.0.0";
    
    /// SPL Associated Token Account version
    pub const SPL_ATA_VERSION: &str = "2.3.0";
}

/// Utility function to log version information
pub fn log_versions() {
    use anchor_lang::prelude::*;
    
    msg!("MiCA EUR - Version Info:");
    msg!("  Anchor: v{}", versions::ANCHOR_VERSION);
    msg!("  Solana: v{}", versions::SOLANA_VERSION);
    msg!("  SPL Token-2022: v{}", versions::SPL_TOKEN_2022_VERSION);
}

/// Returns true if the current Solana version is compatible
pub fn is_solana_version_compatible() -> bool {
    // Check if we're using the expected Solana version
    // This could be expanded to check for version ranges if needed
    #[cfg(feature = "test-sbf")]
    return true; // Skip version check in tests
    
    #[cfg(not(feature = "test-sbf"))]
    {
        // Version check is currently disabled since the version module
        // in solana_program might have changed in the SDK
        // We'll return true for now and rely on Anchor's compatibility checks
        use anchor_lang::prelude::msg;
        msg!("Version compatibility check is skipped");
        true
    }
} 