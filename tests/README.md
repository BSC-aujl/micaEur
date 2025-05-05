# MiCA EUR Test Framework

This directory contains the test framework and tests for the MiCA EUR project.

## TypeScript Test Standards

The MiCA EUR project uses TypeScript for testing to ensure type safety and maintainability. This document outlines the standards for writing tests.

### Directory Structure

- `tests/new-approach/` - Main directory for TypeScript tests
- `tests/framework/` - Test framework helpers and utilities
- `tests/framework/types.ts` - TypeScript type definitions for tests
- `tests/fixtures/` - Test fixtures and mock data

### Test File Naming

- Test files should end with `.test.ts`
- Unit tests for specific components should end with `.spec.ts`
- Filename should reflect what is being tested: `token-mint.test.ts`

### Test Structure

All tests should follow the Mocha BDD style with `describe` and `it` blocks:

```typescript
describe("Feature or Component", () => {
  // Setup that applies to all tests in this describe block
  before(async () => {
    // Setup code
  });

  // Teardown that applies to all tests in this describe block
  after(async () => {
    // Teardown code
  });

  it("should perform specific behavior", async () => {
    // Test code
    // Assert expected outcomes
  });
});
```

### Type Safety

- Always define proper types for variables, functions, and parameters
- Use interfaces and types from `framework/types.ts`
- Avoid using `any` type
- Use async/await instead of Promises with .then()

### Test Context

Use the `TestContext` interface for context passed between tests:

```typescript
import { TestContext } from "../framework/types";

let context: TestContext;

before(async () => {
  context = await setupTestContext();
});
```

### Assertions

Use Chai assertions for consistent test results:

```typescript
import { assert } from "chai";

it("should have the correct value", () => {
  assert.equal(actual, expected);
  assert.isTrue(condition);
  assert.isDefined(variable);
});
```

### Mocking and Fixtures

- Use fixtures for repeated test data
- Create mock objects with proper types

### Test Categories

#### 1. Smoke Tests

Quick tests that verify basic functionality works. These should be fast and reliable.

#### 2. Unit Tests

Tests for individual functions and components in isolation.

#### 3. Functional Tests

Tests that verify specific features work correctly.

#### 4. Comprehensive Tests

End-to-end tests that verify the entire system works correctly.

### Running Tests

Various npm scripts are available to run different test categories:

```bash
# Run all tests
npm run test

# Run smoke tests
npm run test:smoke

# Run specific test categories
npm run test:kyc
npm run test:mint
npm run test:freeze
npm run test:extensions

# Run comprehensive tests
npm run test:comprehensive

# Use the test runner with more options
npm run test:runner smoke
npm run test:runner -- -v all
```

### Pre-commit Validation

Tests are automatically validated during pre-commit via:

1. Type checking
2. Test structure validation
3. Running smoke tests

To manually validate tests:

```bash
npm run validate:tests
```

## Creating New Tests

To create a new test file:

1. Create a file in `tests/new-approach/` with a `.test.ts` extension
2. Import the necessary types and utilities
3. Use the test context to interact with the program
4. Follow the structure guidelines above

Example:

```typescript
import { assert } from "chai";
import { setupTestContext } from "../framework/setup";
import { TestContext } from "../framework/types";

describe("New Feature", () => {
  let context: TestContext;

  before(async () => {
    context = await setupTestContext();
  });

  it("should work correctly", async () => {
    // Test code
    assert.isTrue(true);
  });
});
```

## Test Utilities

The framework provides several utilities for writing tests:

- `setupTestContext()` - Sets up the test context
- `initializeKycOracle()` - Initializes the KYC Oracle
- `createTokenMint()` - Creates a token mint

See the respective files in the `framework/` directory for more utilities.

## Directory Structure

- `/framework` - Core testing utilities and helpers
- `/new-approach` - Tests using the new TypeScript-based framework
- `/unit` - Unit tests (legacy)
- `/functional` - Functional tests (legacy)
- `/fixtures` - Test fixtures and data

## Getting Started

### Prerequisites

Before running tests, make sure you have:

1. Solana CLI tools installed and on your PATH
2. Anchor CLI installed
3. NodeJS and npm installed
4. Test keypairs generated (run `npm run setup:test-keys`)

### Running Tests

The following npm scripts are available for running tests:

```bash
# Run all tests with the new framework
npm test

# Run only KYC Oracle tests
npm run test:kyc

# Run a quick smoke test
npm run test:smoke

# Run comprehensive test suite
npm run test:comprehensive
```

### Environment Setup

To set up a test environment with a local validator:

```bash
# Start a local validator without building the program
npm run setup:test-env

# Start a local validator and build/deploy the program
npm run setup:test-env -- --build
```

## Writing Tests

### Using the Test Framework

The test framework provides a structured way to test Solana programs:

```typescript
import { assert } from "chai";
import { setupTestContext } from "../framework/setup";
import { yourHelperFunction } from "../framework/your-helpers";

describe("Your Test Suite", () => {
  let context: Awaited<ReturnType<typeof setupTestContext>>;

  before(async () => {
    // Set up the test context with default configuration
    context = await setupTestContext();

    // Initialize accounts or state needed for all tests
  });

  it("should test some functionality", async () => {
    // Call your helper functions
    const result = await yourHelperFunction(context, { param1: "value" });

    // Make assertions
    assert.isTrue(result.someProperty);
  });
});
```

### Key Components

1. **Test Context**: Contains the program, wallet, connection, and keypairs needed for testing
2. **Helper Functions**: Utility functions for interacting with the program
3. **Fixtures**: Reusable test data and configurations

### Best Practices

1. **Use the Framework**: Always use the test context and helper functions rather than direct interactions
2. **Isolate Tests**: Each test should be independent and not rely on the state from previous tests
3. **Clean Up**: If you create accounts, consider cleaning them up after tests
4. **Assertions**: Be specific about what you're testing with descriptive assertions
5. **Error Handling**: Test both happy path and error conditions

## Testing Framework Architecture

### Core Components

- `setup.ts` - Sets up the test context with all necessary objects
- `kyc-oracle-helpers.ts` - Helper functions for testing KYC Oracle functionality
- `types.ts` - TypeScript type definitions for testing

### Using Helpers

The framework provides helpers for common tasks:

```typescript
// Initialize the KYC Oracle
const oraclePDA = await initializeKycOracle(context);

// Register a new KYC user
const userPDA = await registerKycUser(context, {
  userKeypair: context.keypairs.user1,
  blz: "12345678",
  ibanHash: Array.from(Buffer.from("DE89...".padEnd(32, "0"))),
  countryCode: "DE",
  verificationProvider: "VERIFF",
});

// Update a user's KYC status
await updateKycStatus(context, {
  kycUserPDA: userPDA,
  status: { verified: {} as Record<string, never> },
  verificationLevel: 2,
  expiryDays: 365,
});
```

## Troubleshooting

### Common Issues

1. **Validator Not Running**: Make sure the Solana validator is running before tests
2. **Program Not Deployed**: Ensure the program is built and deployed to the validator
3. **Test Keypair Errors**: If you see errors about keypairs, run `npm run setup:test-keys`
4. **Transaction Errors**: Check transaction logs for detailed error information

### Debugging Tips

1. Use `console.log` to debug variables
2. Inspect transaction errors carefully
3. Check account data before and after operations
4. Run a single test file with `npx ts-mocha -p ./tests/tsconfig.json path/to/test.ts`

## Contributing

When adding new tests:

1. Follow the existing patterns
2. Add helper functions for reusable operations
3. Keep tests isolated and independent
4. Add clear assertions and error handling
5. Document complex test procedures with comments
