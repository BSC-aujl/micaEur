/// PDA seed for mint info account
pub const MINT_INFO_SEED: &[u8] = b"mint_info";

/// PDA seed for KYC oracle state
pub const KYC_ORACLE_SEED: &[u8] = b"kyc_oracle";

/// PDA seed for KYC user accounts
pub const KYC_USER_SEED: &[u8] = b"kyc_user";

/// Minimum KYC verification level required for transfers
pub const MIN_TRANSFER_KYC_LEVEL: u8 = 1;

/// Minimum KYC verification level required for minting/redeeming
pub const MIN_MINT_REDEEM_KYC_LEVEL: u8 = 2;

/// MiCA-compliant supported countries (ISO codes)
pub const SUPPORTED_COUNTRIES: [&str; 27] = [
    "AT", "BE", "BG", "HR", "CY", "CZ", "DK", 
    "EE", "FI", "FR", "DE", "GR", "HU", "IE", 
    "IT", "LV", "LT", "LU", "MT", "NL", "PL", 
    "PT", "RO", "SK", "SI", "ES", "SE"
];

/// Maximum transaction amount in tokens (100,000 EUR)
pub const MAX_TRANSACTION_AMOUNT: u64 = 100_000_000_000_000;

/// Decimals for the EUR token
pub const EUR_DECIMALS: u8 = 9; 