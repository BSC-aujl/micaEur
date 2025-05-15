# MiCA EUR Tests

Test suite for the MiCA EUR stablecoin implementation.

## Overview

This directory contains tests for the MiCA EUR program using LiteSVM, a lightweight simulator for Solana programs that allows testing without requiring a validator or BPF build.

## Test Files

- **mica-eur-functional-tests.ts** - Comprehensive functional tests for all components
- **kyc-end-to-end-flow.ts** - End-to-end tests for the KYC workflow

## Running Tests

```bash
# Run all functional tests
npm run test:functional

# Run KYC flow tests
npm run test:kyc-flow

# Using test scripts
./scripts/run-functional-tests.sh  # All functional tests
./scripts/run-aml-tests.sh         # AML Authority tests
./scripts/run-kyc-tests.sh         # KYC Oracle tests
./scripts/run-token-tests.sh       # Token functionality tests
./scripts/run-freeze-seize-tests.sh # Freeze/Seize functionality tests
./scripts/run-kyc-end-to-end-test.sh # End-to-end KYC flow tests
```

## Test Structure

Tests are organized into modules:

1. **KYC Oracle Tests** - Tests for user registration and verification
2. **Token Functionality Tests** - Tests for minting, burning, and transfers
3. **AML Authority Tests** - Tests for blacklisting and compliance
4. **Freeze/Seize Tests** - Tests for regulatory actions

## LiteSVM Benefits

- **Faster Execution** - Tests run quickly without requiring a full Solana validator
- **No BPF Compilation** - No need to build BPF code for testing
- **Simplified Testing** - Direct control over account state and transactions
- **Reproducible Results** - Tests are deterministic and easy to debug

## Debugging Tests

For debugging tests:

```bash
# Debug with Node.js inspector
node --inspect-brk --experimental-vm-modules node_modules/mocha/bin/mocha.js -p ./tsconfig.json -t 1000000 tests/mica-eur-functional-tests.ts
```

## Adding New Tests

When adding new tests:

1. Follow the existing patterns in the test file
2. Group related tests into appropriate describe blocks
3. Use descriptive test names that clearly explain what functionality is being tested
4. Make sure to test both happy path and error conditions
