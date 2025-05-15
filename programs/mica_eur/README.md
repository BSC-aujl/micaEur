# MiCA EUR Solana Program

Core implementation of the MiCA-compliant EUR stablecoin on Solana.

## Program Structure

This program is built using the Anchor framework and implements:

- **KYC Oracle**: User verification system with multiple verification levels
- **Token Management**: Minting, burning, and transfer functionality
- **AML Controls**: Authority management and blacklisting
- **Regulatory Compliance**: Account freezing and token seizure capabilities

## Components

- **lib.rs** - Main program entry point and instruction handlers
- **aml.rs** - Anti-Money Laundering functionality
- **constants.rs** - Program constants and configuration values
- **error.rs** - Custom error definitions
- **kyc_oracle.rs** - KYC verification system
- **merkle_info.rs** - Merkle tree implementation for reserve verification
- **mint_utils.rs** - Utilities for token minting and management
- **versions.rs** - Version management and compatibility checks

## Token Implementation

The token uses Solana's SPL Token-2022 program with the following extensions:

- **DefaultAccountState**: Token accounts are frozen by default
- **TransferHook**: Validates transfers against KYC requirements
- **PermanentDelegate**: Allows regulatory seizing of tokens
- **MetadataPointer**: Links to the token's whitepaper

## KYC System

### KYC Verification Levels

- **Unverified (Level 0)**: Can transfer tokens, but cannot mint or redeem
- **Basic (Level 1)**: Individual users with verified bank accounts, can mint and redeem
- **Standard (Level 2)**: Business users with additional compliance checks, higher limits
- **Advanced (Level 3)**: Institutional users with comprehensive checks, highest limits

### KYC Implementation Example

```typescript
// Initialize KYC Oracle
await program.methods
  .initializeKycOracle()
  .accounts({
    authority: kycAuthority.publicKey,
    kycOracleState: kycOracleStatePda,
    systemProgram: SystemProgram.programId,
    rent: SYSVAR_RENT_PUBKEY,
  })
  .signers([kycAuthority])
  .rpc();

// Register a user for KYC
await program.methods
  .registerKycUser(
    "10070000", // BLZ (German bank code)
    ibanHash,   // SHA-256 hash of the IBAN
    "DE",       // Country code
    "veriff"    // Verification provider
  )
  .accounts({
    authority: kycAuthority.publicKey,
    kycOracleState: kycOracleStatePda,
    user: userWallet.publicKey,
    kycUser: kycUserPda,
    systemProgram: SystemProgram.programId,
    rent: SYSVAR_RENT_PUBKEY,
  })
  .signers([kycAuthority])
  .rpc();
```

## AML Features

The Anti-Money Laundering system includes:

1. **AML Authorities**: Entities that can enforce AML controls
2. **Blacklist Management**: Tracking of blacklisted addresses
3. **Account Freezing**: Ability to freeze suspicious accounts
4. **Token Seizure**: Capability to seize tokens when required by regulators

## Building

This program requires specific toolchain configurations:
- Rust nightly-2025-05-11
- Solana CLI v1.18.17
- Anchor CLI v0.30.1

Build from the repository root using:
```bash
anchor build
```

## Testing

Tests are located in the repository's `tests` directory and can be run with:
```bash
npm run test:functional
``` 