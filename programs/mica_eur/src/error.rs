use anchor_lang::prelude::*;

#[error_code]
pub enum MicaEurError {
    #[msg("User is not KYC verified")]
    UserNotVerified,

    #[msg("User KYC verification has expired")]
    KycExpired,

    #[msg("User verification level is insufficient")]
    InsufficientVerificationLevel,

    #[msg("Country is not supported")]
    CountryNotSupported,

    #[msg("Mint is inactive")]
    MintInactive,

    #[msg("Invalid amount")]
    InvalidAmount,

    #[msg("Account is frozen")]
    AccountFrozen,

    #[msg("Only issuer can mint tokens")]
    NotIssuer,

    #[msg("Only freeze authority can freeze/thaw accounts")]
    NotFreezeAuthority,

    #[msg("Only permanent delegate can seize tokens")]
    NotPermanentDelegate,

    #[msg("Invalid transfer hook program")]
    InvalidTransferHookProgram,

    #[msg("Invalid metadata pointer URI")]
    InvalidMetadataURI,

    #[msg("Invalid reserve proof")]
    InvalidReserveProof,
} 