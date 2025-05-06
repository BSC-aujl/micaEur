# Test Utilities

This directory contains shared utility functions and types used across the test suite. These utilities help maintain consistent testing patterns, reduce code duplication, and ensure type safety.

## Available Utilities

### Types (`types.ts`)

Contains shared TypeScript interfaces and types used throughout the test suite:

- `TestContext` - Primary context object passed between test helpers
- `KycStatus`, `KycVerificationLevel` - KYC-related types
- `BlacklistEntry`, `BlacklistReason` - Blacklist-related types
- `AmlAuthority`, `AmlAlert` - AML-related types
- Other shared type definitions

### Setup (`setup.ts`)

Functions for setting up test environments:

- `setupTestContext()` - Creates a test context with initialized program, provider, and keypairs
- `createTestKeypairs()` - Generates keypairs for testing
- `initializeTokenMint()` - Sets up a token mint for testing

### KYC Oracle Helpers (`kyc-oracle-helpers.ts`)

Functions for working with the KYC Oracle:

- `initializeKycOracle()` - Initialize the KYC Oracle
- `registerKycUser()` - Register a user with the KYC system
- `updateKycStatus()` - Update a user's KYC status
- `isKycVerified()` - Check if a user is KYC verified

### KYC Provider Helpers (`kyc-provider-helpers.ts`)

Functions for working with third-party KYC providers:

- `registerKycProvider()` - Register a new KYC provider
- `processThirdPartyVerification()` - Process KYC verification from a third-party
- `signVerificationData()` - Create signed verification data

### Blacklist Helpers (`blacklist-helpers.ts`)

Functions for managing the blacklist:

- `addToBlacklist()` - Add a user to the blacklist
- `updateBlacklistEntry()` - Update a blacklist entry
- `removeFromBlacklist()` - Remove a user from the blacklist
- `isBlacklisted()` - Check if a user is blacklisted

### AML Authority Helpers (`aml-authority-helpers.ts`)

Functions for AML authorities and alerts:

- `registerAmlAuthority()` - Register a new AML authority
- `createAmlAlert()` - Create an AML alert
- `updateAmlAlert()` - Update an AML alert
- `takeAmlAction()` - Take action based on an AML alert

### Token Mint Helpers (`token-mint-helpers.ts`)

Functions for token minting and management:

- `createMicaEurMint()` - Create a MiCA EUR token mint
- `mintTokensToRecipients()` - Mint tokens to recipients
- `setTokenMintRestrictions()` - Configure token mint restrictions
- `isRedemptionAllowed()` - Check if redemption is allowed

### Token Utilities (`token-utils.ts`)

Low-level token utilities:

- `getTokenAccountInfo()` - Get token account information
- `getMintInfo()` - Get token mint information
- `getTokenBalance()` - Get token balance
- `isTokenAccountFrozen()` - Check if a token account is frozen

### Freeze/Seize Helpers (`freeze-seize-helpers.ts`)

Functions for freezing accounts and seizing tokens:

- `freezeAccount()` - Freeze a token account
- `unfreezeAccount()` - Unfreeze a token account
- `seizeTokens()` - Seize tokens from an account

## Usage Examples

### Setting up a test context

```typescript
import { setupTestContext } from "../utils/setup";
import { TestContext } from "../utils/types";

describe("My Test Suite", () => {
  let context: TestContext;

  before(async () => {
    context = await setupTestContext();
  });

  // Tests using the context...
});
```

### Using KYC helpers

```typescript
import { registerKycUser, updateKycStatus } from "../utils/kyc-oracle-helpers";
import { KycVerificationLevel } from "../utils/types";

// Register a new KYC user
const kycUserPDA = await registerKycUser(context, {
  userKeypair,
  blz: "12345678",
  ibanHash: "DE89370400440532013000",
  countryCode: 49,
  verificationProvider: "TEST-PROVIDER",
  verificationLevel: KycVerificationLevel.User,
});

// Verify the user
await updateKycStatus(context, {
  kycUserPDA,
  status: { verified: {} },
  verificationLevel: KycVerificationLevel.User,
  expiryDays: 365,
});
```

### Working with tokens

```typescript
import { createMicaEurMint, mintTokensToRecipients } from "../utils/token-mint-helpers";

// Create a token mint
const mint = await createMicaEurMint(context, {
  issuer: issuerKeypair.publicKey,
  freezeAuthority: authorityKeypair.publicKey,
  permanentDelegate: authorityKeypair.publicKey,
  whitePaperUri: "https://example.com/whitepaper.pdf",
});

// Mint tokens to users
await mintTokensToRecipients(context, {
  mint,
  authority: issuerKeypair,
  recipients: [
    { recipient: user1.publicKey, amount: 1000 },
    { recipient: user2.publicKey, amount: 500 },
  ],
});
```

## Best Practices

1. **Use Types**: Always use proper type annotations when working with these utilities
2. **Avoid Any**: Use proper type assertions instead of 'any' when possible
3. **Error Handling**: Always handle errors from these functions
4. **Context Reuse**: Pass the test context between functions to maintain state
5. **Test Isolation**: Ensure each test properly sets up and cleans up its environment 