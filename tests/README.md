# MiCA EUR Test Suite

This directory contains the tests for the MiCA EUR stablecoin project.

## Test Directory Structure

```
tests/
├── e2e/             # End-to-end tests that verify full system functionality
├── integration/     # Integration tests that verify interaction between components
├── unit/            # Unit tests that verify individual components
├── utils/           # Shared utilities and helper functions
├── templates/       # Templates for creating new tests
└── fixtures/        # Test fixtures and mock data
```

## Test Types

### Unit Tests

Unit tests are focused on testing individual components in isolation. They're typically smaller, faster, and more focused.

Example: Testing token mint functions, KYC verification, or individual account structures.

### Integration Tests

Integration tests verify that multiple components work together correctly. They test the interaction between different parts of the system.

Example: Testing the blacklisting system together with token transfers, or testing AML authorities with the KYC system.

### End-to-End Tests

End-to-end tests verify complete workflows and user journeys. They test the entire system working together.

Example: The comprehensive test verifies the full system flow from KYC verification to minting, transfers, freezing, and redemption.

## Running Tests

To run tests, use the following npm scripts:

```bash
# Run all tests
npm run test

# Run specific test types
npm run test:unit
npm run test:integration
npm run test:e2e

# Run specific test groups
npm run test:kyc        # Run KYC Oracle tests
npm run test:mint       # Run token mint tests
npm run test:freeze     # Run freeze/seize tests
npm run test:extensions # Run token extensions tests
npm run test:comprehensive  # Run complete end-to-end tests
```

## Creating New Tests

Use the test creator script to create new tests:

```bash
node scripts/create-test.js
```

This interactive script will:
1. Ask for a test name
2. Ask which type of test you want to create (unit, integration, or e2e)
3. Create a new test file from a template in the appropriate directory

## Test Utilities

Common helper functions are available in the `utils/` directory:

- `setup.ts` - Common test setup utilities
- `token-utils.ts` - Token-related utility functions
- `kyc-oracle-helpers.ts` - KYC verification helpers
- `token-mint-helpers.ts` - Token minting helpers
- `blacklist-helpers.ts` - Blacklist management helpers
- `freeze-seize-helpers.ts` - Account freeze and token seizure helpers

## Continuous Integration

Tests are run automatically as part of the CI/CD pipeline and via pre-commit hooks to ensure code quality.
