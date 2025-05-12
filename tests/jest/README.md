# MiCA EUR Jest Tests

This directory contains Jest tests for the MiCA EUR program. We use two approaches for testing:

1. **Validator-based tests** that connect to a deployed program on a local or remote Solana cluster
2. **LiteSVM-based tests** that use a lightweight simulation environment without requiring a validator

## Test Files

- `mica-eur.test.ts` - Basic program verification tests with validator
- `mica-eur-full.test.ts` - More comprehensive tests with Anchor + validator
- `mica-eur-litesvm.test.ts` - Tests using LiteSVM simulation (no validator required)
- `utils/litesvm-helper.ts` - Helper utilities for LiteSVM testing

## Prerequisites

- Node.js and npm
- Solana CLI for validator-based tests
- Deployed MiCA EUR program for validator tests (not needed for LiteSVM tests)

## Running Tests

### Validator-Based Tests

These tests require a running Solana validator with the MiCA EUR program deployed:

```bash
# Run basic verification tests
npm run test:jest

# Run comprehensive tests
npm run test:jest:full

# Run tests with validator management via script
npm run test:jest:script
```

### LiteSVM Tests

These tests use LiteSVM simulation and do not require a validator or program deployment:

```bash
# Run LiteSVM-based tests
npm run test:jest:litesvm
```

## Test Structure

### Validator-Based Tests

These tests verify the deployed program:

1. Connect to a Solana cluster (local or remote)
2. Verify the program is deployed and executable
3. Test program instructions using the Anchor framework

### LiteSVM-Based Tests

These tests simulate the program's behavior without a validator:

1. Create a LiteSVM instance for Solana simulation
2. Manually setup account states to represent program data
3. Test state changes through direct account manipulation
4. Verify expected behaviors across different scenarios

## Using LiteSVM Helpers

The `litesvm-helper.ts` file provides utilities for common testing operations:

```typescript
// Setup the test environment
const { svm, keypairs, pdas, tokenAccounts } = setupLiteSvmTestEnv(PROGRAM_ID);

// Create various account types
createKycOracleState(svm, PROGRAM_ID, kycOracleStatePda, authority.publicKey);
createKycUser(svm, PROGRAM_ID, userKycPda, authority.publicKey, userPubkey);
createMintInfo(svm, PROGRAM_ID, mintInfoPda, mintPubkey, issuerPubkey);
createTokenAccount(svm, tokenAccount, mintPubkey, ownerPubkey, balance);

// Modify and query account data
updateTokenBalance(svm, tokenAccount, newBalance);
const tokenInfo = getTokenAccountInfo(svm, tokenAccount);
```

## Benefits of the Dual Testing Approach

1. **Speed**: LiteSVM tests run quickly without validator startup/deployment
2. **Reliability**: Validator tests ensure real-world compatibility
3. **Coverage**: Test both account-level logic and on-chain behavior
4. **No BPF required**: LiteSVM tests don't need program compilation

## Adding New Tests

When adding new tests:

1. **Choose the right approach**: Use LiteSVM for unit tests and validator for integration tests
2. **Reuse helpers**: Leverage the helper functions in `litesvm-helper.ts`
3. **Follow patterns**: Match the structure of existing tests
4. **Keep tests independent**: Each test should setup its own state 