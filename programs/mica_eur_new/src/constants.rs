use anchor_lang::prelude::*;
use anchor_spl::token_2022::spl_token_2022::ID as TOKEN_2022_PROGRAM_ID;

// PDA seeds
pub const MINT_INFO_SEED: &[u8] = b"mint-info";
pub const KYC_ORACLE_STATE_SEED: &[u8] = b"kyc-oracle-state";
pub const KYC_USER_SEED: &[u8] = b"kyc-user";

// Verification levels for KYC
pub const MIN_VERIFICATION_LEVEL_FOR_TRANSFERS: u8 = 1;
pub const MIN_VERIFICATION_LEVEL_FOR_MINT_REDEEM: u8 = 2;

// Supported countries (ISO 3166-1 alpha-2 codes) for MiCA compliance
// This is a whitelist of countries that are supported
pub const SUPPORTED_COUNTRIES: [&str; 27] = [
    // EU member states
    "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", 
    "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", 
    "PL", "PT", "RO", "SK", "SI", "ES", "SE",
];

// Maximum transaction amount (in token units)
// 100,000 EUR with 9 decimals
pub const MAX_TRANSACTION_AMOUNT: u64 = 100_000 * 1_000_000_000;

// Decimals for the EUR token
pub const EUR_DECIMALS: u8 = 9;

// Reference the Token 2022 Program ID
pub fn token_2022_program_id() -> Pubkey {
    TOKEN_2022_PROGRAM_ID
}

// Helper function to check if a country is supported
pub fn is_country_supported(country_code: &str) -> bool {
    SUPPORTED_COUNTRIES.contains(&country_code)
} 