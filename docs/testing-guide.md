# MiCA EUR Testing Guide

This guide provides an overview of the testing framework for the MiCA EUR token system, explaining the different types of tests and how to run them.

## Testing Overview

The MiCA EUR project uses a comprehensive testing strategy that includes:

1. **Mock Tests** - Test functionality without a real Solana connection
2. **Real Tests** - Test against a local Solana validator
3. **Smoke Tests** - Basic health checks
4. **Unit Tests** - Testing individual components
5. **Integration Tests** - Testing interactions between components
6. **End-to-End Tests** - Testing complete workflows

## Test Environment Setup

The test environment is configured in `tests/utils/env-setup.ts`. This file sets up:

- The Anchor provider
- The program ID
- The connection to the Solana cluster
- Mock or real mode based on the `MOCK_TEST_MODE` environment variable

### Mock vs. Real Testing

The framework supports two testing modes:

- **Mock Mode**: Tests don't require a Solana connection and use mock implementations of program methods. This is faster and suitable for CI/CD pipelines.
- **Real Mode**: Tests interact with a local Solana validator. This provides a more realistic test but requires a running validator.

## Running Tests

The project provides various npm scripts for running tests:

```bash
# Run mock tests (no Solana connection required)
npm run test:mock

# Run real tests with a local validator
npm run test:real

# Run specific types of tests
npm run test:smoke        # Basic smoke tests
npm run test:unit         # Unit tests (includes mock tests)
npm run test:real:unit    # Real unit tests with validator
npm run test:integration  # Integration tests
npm run test:real:e2e     # Real end-to-end tests
```

### Running a Specific Test

To run a specific test file:

```bash
npm run test:mock -- --test "tests/unit/mock-freeze-seize.test.ts"
npm run test:real:unit -- --test "tests/unit/real-freeze-seize.test.ts"
```

## Test Structure

### Mock Test Structure

Mock tests use the `setupMockTestContext()` function to create a test environment with mock implementations:

```typescript
import { setupMockTestContext } from "../utils/mock-setup";

describe("Mock Test Suite", () => {
  let context: any;
  
  before(async () => {
    context = setupMockTestContext();
  });
  
  it("should call program method", async () => {
    const result = await context.program.methods
      .someMethod()
      .accounts({})
      .signers([])
      .rpc();
      
    assert.equal(result, "mock_signature");
  });
});
```

### Real Test Structure

Real tests use the `setupTestContext()` function to create a test environment with a real connection:

```typescript
import { setupTestContext } from "../utils/setup";

describe("Real Test Suite", () => {
  let context: any;
  
  before(async () => {
    context = await setupTestContext();
    // Set up accounts, initialize program state, etc.
  });
  
  it("should perform real operation", async () => {
    // Perform operations and assertions
  });
});
```

## Key Test Components

### KYC Oracle Tests

The KYC Oracle tests verify the functionality for:
- Initializing the KYC Oracle
- Registering KYC users
- Updating KYC status
- Verifying KYC status

### Token Mint Tests

The token mint tests verify:
- Initializing a Euro mint
- Creating token accounts
- Minting tokens
- Burning tokens
- Updating reserve proofs

### Freeze and Seize Tests

The freeze and seize tests verify the regulatory control features:
- Freezing user accounts
- Thawing previously frozen accounts
- Seizing tokens from frozen accounts

These tests are crucial for ensuring the MiCA EUR token meets regulatory requirements for asset freezing and seizure in cases of financial crime or legal orders.

## Test Helpers

The project includes several helper files to assist with testing:

- `tests/utils/setup.ts` - Sets up the test context
- `tests/utils/mock-setup.ts` - Sets up a mock test context
- `tests/utils/kyc-oracle-helpers.ts` - Helpers for KYC Oracle operations
- `tests/utils/token-mint-helpers.ts` - Helpers for token mint operations
- `tests/utils/types.ts` - Type definitions for testing

## Best Practices

1. **Use the appropriate test mode**: Use mock tests for fast local development and CI/CD. Use real tests for more thorough validation.
2. **Test both positive and negative paths**: Ensure tests cover both successful operations and expected failure conditions.
3. **Keep tests independent**: Each test should be able to run on its own without depending on other tests.
4. **Use descriptive test names**: Test names should describe what's being tested and the expected outcome.
5. **Maintain test coverage**: Aim to cover all important functionality with tests.

## Troubleshooting

If tests are failing, check:

1. **Environment setup**: Make sure your environment variables are set correctly.
2. **Local validator**: If running real tests, ensure the local validator is running.
3. **Program deployment**: For real tests, the program should be properly built and deployed to the local validator.
4. **Test dependencies**: Some tests may have dependencies on other components being initialized first.

## Contributing New Tests

When adding new tests:

1. Create appropriate mock tests for CI/CD pipelines
2. Create real tests for thorough validation
3. Update this testing guide if adding new testing patterns or components
4. Ensure tests run independently of other tests 