# MiCA EUR KYC Flow Guide

This guide explains the end-to-end KYC (Know Your Customer) flow in the MiCA EUR stablecoin. KYC verification is a critical regulatory requirement for any financial service, particularly for stablecoins that are subject to MiCA regulations.

## KYC Flow Overview

The MiCA EUR stablecoin implements a comprehensive KYC flow that includes:

1. **KYC Oracle Initialization**: Setting up the centralized authority for KYC verification
2. **User Registration**: Registering users in the KYC system
3. **KYC Verification**: Updating user KYC status and verification level
4. **Account Creation**: Creating token accounts that are initially frozen
5. **Account Thawing**: Thawing accounts for KYC-verified users
6. **Token Operations**: Minting, transferring, and burning tokens based on KYC status

## KYC Status and Verification Levels

### KYC Status

Each user can have one of the following KYC statuses:

- **Unverified**: The user has not started the KYC process
- **Pending**: The user has submitted KYC information but is not yet verified
- **Verified**: The user has successfully completed KYC verification
- **Rejected**: The user's KYC verification was rejected
- **Expired**: The user's KYC verification has expired
- **Suspended**: The user's KYC status is temporarily suspended

### Verification Levels

Verification levels determine what operations a user can perform:

- **Level 0 (None)**: No verification, cannot perform any operations
- **Level 1 (Basic)**: Basic verification, can transfer tokens but cannot mint or redeem
- **Level 2 (Standard)**: Standard verification, can mint, transfer, and redeem tokens
- **Level 3 (Advanced)**: Advanced verification, can perform all operations with higher limits

## End-to-End KYC Flow

### 1. Initialize KYC Oracle

The KYC Oracle is a central authority that manages user verification. Only the designated authority can update KYC statuses.

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
```

### 2. Register User for KYC

Users must register for KYC verification by providing their banking information:

```typescript
// Register a user for KYC
await program.methods
  .registerKycUser(
    "10070000", // BLZ (German bank code)
    ibanHash, // SHA-256 hash of the IBAN
    "DE", // Country code
    "veriff" // Verification provider
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

### 3. Update KYC Status

After off-chain verification, the KYC authority updates the user's status:

```typescript
// Update KYC status to Verified with Standard level
await program.methods
  .updateKycStatus(
    { verified: {} }, // KYC status enum
    2, // Verification level (Standard)
    365 // Expiry days (1 year)
  )
  .accounts({
    authority: kycAuthority.publicKey,
    kycOracleState: kycOracleStatePda,
    kycUser: kycUserPda,
  })
  .signers([kycAuthority])
  .rpc();
```

### 4. Create Token Account

Token accounts are initially created with a frozen state:

```typescript
// Create a token account (initially frozen)
await program.methods
  .createTokenAccount()
  .accounts({
    owner: userWallet.publicKey,
    tokenAccount: tokenAccountAddress,
    mint: mintKeypair.publicKey,
    mintInfo: mintInfoPda,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_2022_PROGRAM_ID,
    rent: SYSVAR_RENT_PUBKEY,
  })
  .signers([userWallet])
  .rpc();
```

### 5. Thaw Account

For KYC-verified users, their accounts can be thawed:

```typescript
// Thaw a token account after KYC verification
await program.methods
  .thawAccount()
  .accounts({
    freezeAuthority: freezeAuthority.publicKey,
    mintInfo: mintInfoPda,
    mint: mintKeypair.publicKey,
    tokenAccount: tokenAccountAddress,
    tokenProgram: TOKEN_2022_PROGRAM_ID,
  })
  .signers([freezeAuthority])
  .rpc();
```

### 6. Mint Tokens

Only users with Standard verification level (2) or higher can mint tokens:

```typescript
// Mint tokens to a KYC-verified user with Standard verification
await program.methods
  .mintTokens(
    new BN(1000_000_000_000) // 1000 tokens with 9 decimals
  )
  .accounts({
    issuer: issuer.publicKey,
    mintInfo: mintInfoPda,
    mint: mintKeypair.publicKey,
    tokenAccount: tokenAccountAddress,
    kycUser: kycUserPda,
    freezeAuthority: freezeAuthority.publicKey,
    tokenProgram: TOKEN_2022_PROGRAM_ID,
  })
  .signers([issuer])
  .rpc();
```

### 7. Transfer Tokens

Users with at least Basic verification level (1) can transfer tokens:

```typescript
// Transfer tokens between KYC-verified users
await program.methods
  .transfer(
    new BN(100_000_000_000) // 100 tokens
  )
  .accounts({
    source: senderTokenAccount,
    destination: receiverTokenAccount,
    owner: senderWallet.publicKey,
    tokenProgram: TOKEN_2022_PROGRAM_ID,
  })
  .signers([senderWallet])
  .rpc();
```

## KYC Integration with Regulatory Features

The KYC system integrates with other regulatory features:

### AML Integration

AML authorities can freeze accounts and seize tokens based on AML rules:

```typescript
// Freeze an account for AML concerns
await program.methods
  .freezeAccount()
  .accounts({
    freezeAuthority: freezeAuthority.publicKey,
    mintInfo: mintInfoPda,
    mint: mintKeypair.publicKey,
    tokenAccount: suspiciousAccount,
    tokenProgram: TOKEN_2022_PROGRAM_ID,
  })
  .signers([freezeAuthority])
  .rpc();
```

### KYC Expiry and Renewal

KYC verification has an expiry date. Users must renew their verification before it expires:

```typescript
// Check if KYC verification is still valid
const currentTime = Clock.get().unix_timestamp;
const isValid = kyc_user.status === KycStatus.Verified && currentTime < kyc_user.expiry_time;
```

## Testing the KYC Flow

The repository includes a comprehensive end-to-end test that demonstrates the complete KYC flow:

```bash
# Run the KYC end-to-end flow test
npm run test:kyc-flow
```

This test covers all aspects of the KYC flow from initialization to token operations.

## Regulatory Compliance

The KYC system is designed to meet regulatory requirements:

1. **MiCA Compliance**: Aligns with EU's Markets in Crypto-Assets regulations
2. **FATF Recommendations**: Follows Financial Action Task Force guidelines
3. **AML/CFT**: Supports Anti-Money Laundering and Counter-Terrorist Financing checks
4. **Travel Rule**: Enables compliance with the FATF Travel Rule

By implementing this comprehensive KYC flow, MiCA EUR ensures regulatory compliance while providing a seamless user experience for verified users. 