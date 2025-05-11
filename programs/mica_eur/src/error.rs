use anchor_lang::prelude::*;

#[error_code]
pub enum MicaEurError {
    #[msg("User is not KYC verified")]
    UserNotVerified,
    
    #[msg("User KYC verification has expired")]
    UserVerificationExpired,
    
    #[msg("User's KYC verification level is insufficient for this operation")]
    InsufficientVerificationLevel,
    
    #[msg("Transaction amount exceeds maximum allowed")]
    TransactionAmountExceedsMaximum,
    
    #[msg("Country not supported under MiCA regulation")]
    UnsupportedCountry,
    
    #[msg("Account is already frozen")]
    AccountAlreadyFrozen,
    
    #[msg("Account is not frozen")]
    AccountNotFrozen,
    
    #[msg("Caller is not the mint authority")]
    NotMintAuthority,
    
    #[msg("Invalid KYC status")]
    InvalidKycStatus,
    
    #[msg("Invalid verification level")]
    InvalidVerificationLevel,
    
    #[msg("Invalid expiry date")]
    InvalidExpiryDate,
    
    #[msg("User already registered for KYC")]
    UserAlreadyRegistered,
    
    #[msg("Invalid country code format")]
    InvalidCountryCode,
    
    #[msg("Token account does not belong to the KYC verified user")]
    TokenAccountOwnerMismatch,
} 