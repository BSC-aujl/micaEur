# MiCA EUR Test Suite

This directory contains the tests for the MiCA EUR stablecoin project.

## Test Directory Structure

```
tests/
├── e2e/             # End-to-end tests that verify full system functionality
├── integration/     # Integration tests that verify interaction between components
├── unit/            # Unit tests that verify individual components
├── functional/      # Functional/flow tests for specific use cases
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

### Functional Tests

Functional tests verify specific business flows or use cases. They focus on testing a particular functionality from a user's perspective.

Example: Redemption flow, regulatory compliance, reserve backing.

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

## Test Utilities

Common helper functions are available in the `utils/` directory:

- `setup.ts` - Common test setup utilities
- `types.ts` - TypeScript types and interfaces
- `token-utils.ts` - Token-related utility functions
- `kyc-oracle-helpers.ts` - KYC verification helpers
- `kyc-provider-helpers.ts` - KYC provider management helpers
- `token-mint-helpers.ts` - Token minting helpers
- `blacklist-helpers.ts` - Blacklist management helpers
- `aml-authority-helpers.ts` - AML authority and alert helpers
- `freeze-seize-helpers.ts` - Account freeze and token seizure helpers

## Creating New Tests

Use the test creator script to create new tests:

```bash
node scripts/create-test.js
```

This interactive script will:
1. Ask for a test name
2. Ask which type of test you want to create (unit, integration, or e2e)
3. Create a new test file from a template in the appropriate directory

## Test Naming Conventions

All test files follow these naming conventions:

- Unit tests: `feature-name.test.ts`
- Integration tests: `feature-interaction.test.ts`
- E2E tests: `workflow-name.test.ts`
- Functional tests: `use-case-name.test.ts`

## Continuous Integration

Tests are run automatically as part of the CI/CD pipeline and via pre-commit hooks to ensure code quality.

## Testing TypeScript Standards

The test suite applies strong TypeScript standards:

- Proper type definitions for test data
- Avoidance of 'any' type where possible
- Consistent error handling patterns
- Clear test assertions and descriptions

## Recent Test Migration

The test suite was recently migrated to a more organized structure:
- Consolidated all helper functions in `utils/` 
- Organized tests by type (unit, integration, e2e, functional)
- Updated import paths and dependencies
- Removed duplicate test files

Legacy test files from the previous structure were moved to the appropriate directories, with stub files left in their original locations pointing to the new locations to avoid breaking existing references.
