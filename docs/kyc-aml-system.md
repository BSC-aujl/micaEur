# KYC and AML System Documentation

This document outlines the Know Your Customer (KYC) and Anti-Money Laundering (AML) systems implemented in the MiCA EUR stablecoin project.

## Overview

The MiCA EUR stablecoin implements a comprehensive KYC and AML system to ensure regulatory compliance with the Markets in Crypto-Assets (MiCA) regulation. The system includes:

1. **KYC Verification Levels**
2. **Third-Party KYC Provider Integration**
3. **Blacklisting Mechanism**
4. **AML Authority Management**
5. **Token Usage Rules Based on KYC Status**

## KYC Verification Levels

The system supports three distinct KYC verification levels:

| Level | Name     | Description             | Requirements                                                |
| ----- | -------- | ----------------------- | ----------------------------------------------------------- |
| 0     | None     | No KYC verification     | Basic token ownership only                                  |
| 1     | User     | Individual verification | Full name, ID document, proof of address                    |
| 2     | Business | Company verification    | Business registration, beneficial owners, company documents |

These levels determine what actions users can perform with the token:

- **Level 0 (None)**: Can own and transfer tokens, but cannot redeem or use certain DeFi services
- **Level 1 (User)**: Can redeem tokens at the issuer and use all services
- **Level 2 (Business)**: Can redeem tokens and provide liquidity/DeFi services

## Token Usage Rules

The MiCA EUR token implements the following usage rules:

1. **Basic Ownership**: Any non-blacklisted address can own and transfer tokens
2. **Redemption**: Requires "User" KYC for individuals or "Business" KYC for companies
3. **DeFi Services**: Liquidity pools and lending services may require KYC, depending on whether they are offered by a business or used by a user

## Third-Party KYC Provider Integration

The system supports integration with third-party KYC providers to streamline the verification process:

### Provider Management

- **Registration**: Authorized parties can register trusted KYC providers
- **Provider Information**: Each provider has a unique identifier, name, supported verification levels, and a trust score
- **Status Management**: Providers can be activated or deactivated

### Verification Process

1. User completes KYC with a third-party provider
2. Provider signs verification data with their private key
3. Signed verification data is submitted to the smart contract
4. Contract verifies the signature and updates the user's KYC status

## Blacklisting Mechanism

The blacklisting system allows for restricting malicious or non-compliant users:

### Blacklist Reasons

- KYC Revoked
- Suspicious Activity
- Regulatory Order
- Court Order
- AML Alert
- Other

### Blacklist Actions

The system supports several types of restrictions:

- **Freeze**: Prevent all token transfers
- **Seize**: Allow authorized authorities to seize tokens
- **Restrict**: Limit certain token operations

### Blacklist Management

Authorized parties can:

- Add users to the blacklist
- Update blacklist entries (change reason, evidence, expiry)
- Remove users from the blacklist

## AML Authority Management

The system allows for registering and managing Anti-Money Laundering authorities:

### Authority Powers

- **View Transactions**: Access to transaction data
- **Freeze Accounts**: Authority to freeze suspicious accounts
- **Seize Funds**: Authority to seize tokens
- **Request User Info**: Authority to request additional user information
- **Issue Regulatory Communications**: Authority to issue official notices
- **Block New Transactions**: Authority to prevent new transactions

### AML Alerts

Authorities can create and manage alerts for suspicious activities:

- **Alert Creation**: Create alerts with severity levels, descriptions, and evidence
- **Alert Management**: Update alerts as investigation progresses
- **Alert Resolution**: Take actions based on investigation results

### Risk-Based Approach

The system implements a risk-based approach to KYC:

1. Basic verification for standard users
2. Enhanced due diligence for higher-risk activities
3. Ongoing monitoring with adjustable requirements based on risk scoring

## Implementation Details

### Key Components

1. **KYC Oracle**: Central registry for KYC verification status
2. **Blacklist Registry**: Database of restricted addresses
3. **AML Authority Registry**: Management of authorized AML authorities
4. **Token Smart Contract**: Enforces usage rules based on KYC status

### Data Models

#### KYC User Account

```typescript
interface KycUser {
  authority: PublicKey;
  user: PublicKey;
  status: KycStatus; // unverified, pending, verified, rejected
  verificationLevel: KycVerificationLevel; // None, User, Business
  requiredVerificationLevel: KycVerificationLevel; // For risk-based approach
  // Additional KYC information...
}
```

#### Blacklist Entry

```typescript
interface BlacklistEntry {
  user: PublicKey;
  reason: BlacklistReason;
  evidence: string;
  expiryDate: number | null; // null = permanent
  actionType: BlacklistActionType;
  // Additional blacklist information...
}
```

#### AML Authority

```typescript
interface AmlAuthority {
  authorityId: string;
  name: string;
  institution: string;
  jurisdiction: string;
  powers: AmlAuthorityPower[];
  active: boolean;
  // Additional authority information...
}
```

#### AML Alert

```typescript
interface AmlAlert {
  alertId: string;
  authorityId: string;
  user: PublicKey;
  severity: number;
  description: string;
  status: string;
  transactionIds: string[];
  // Additional alert information...
}
```

## Usage Examples

### Basic Token Transfer (No KYC Required)

```typescript
// Any user can transfer tokens to a non-blacklisted address
await transfer(
  connection,
  sender,
  senderTokenAccount,
  recipientTokenAccount,
  sender,
  amount
);
```

### Token Redemption (KYC Required)

```typescript
// Only KYC verified users can redeem tokens
if (await isRedemptionAllowed(context, userPublicKey)) {
  await transfer(
    connection,
    user,
    userTokenAccount,
    issuerAccount,
    user,
    amount,
    [authority], // Additional signer for redemption approval
    { commitment: "confirmed" }
  );
}
```

### AML Authority Registration

```typescript
// Register a new AML authority
await registerAmlAuthority(context, {
  authorityId: "EU-FIU",
  name: "EU Financial Intelligence Unit",
  institution: "European Union",
  jurisdiction: "EU",
  contactEmail: "contact@eu-fiu.example.com",
  powers: [
    AmlAuthorityPower.ViewTransactions,
    AmlAuthorityPower.FreezeAccounts,
    AmlAuthorityPower.RequestUserInfo,
  ],
});
```

### Creating an AML Alert

```typescript
// Create an alert for suspicious activity
await createAmlAlert(context, {
  alertId: `ALERT-${Date.now()}`,
  authorityId: "EU-FIU",
  userPublicKey,
  severity: 3,
  description: "Suspicious transaction pattern detected",
  transactionIds: ["tx123", "tx456"],
  status: "OPEN",
});
```

## Security Considerations

1. **Private Key Management**: Secure management of authority keys
2. **Evidence Storage**: Only store hashes/references to evidence, not the evidence itself
3. **Data Privacy**: Compliance with GDPR and other privacy regulations
4. **Upgradeability**: Support for upgrading the system as regulations evolve
5. **Multi-sig Controls**: Require multiple approvals for sensitive operations

## Regulatory Compliance

This implementation supports compliance with:

1. **MiCA Regulation**: European Union's Markets in Crypto-Assets regulation
2. **FATF Recommendations**: Financial Action Task Force guidelines for VASPs
3. **BSA/AML**: Bank Secrecy Act and Anti-Money Laundering requirements
4. **Travel Rule**: Information sharing requirements for crypto transactions
