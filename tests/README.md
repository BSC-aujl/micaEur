# MiCA EUR Tests

This directory contains the LiteSVM tests for the MiCA EUR program. We use LiteSVM, a lightweight simulator for Solana programs that allows testing without requiring a validator or BPF build.

## Test Files

- `mica-eur-functional-tests.ts`: Comprehensive functional tests for all MiCA EUR components:
  - KYC Oracle functionality
  - Token operations
  - AML Authority
  - Freeze/Seize functionality

## Running Tests

We provide multiple scripts to run different test components:

```bash
# Run all functional tests
npm run test:functional

# Run specific test suites
npm run test:kyc             # KYC Oracle tests
npm run test:token           # Token functionality tests
npm run test:aml             # AML Authority tests
npm run test:freeze-seize    # Freeze/Seize functionality tests
```

## Test Structure

The main functional test file (`mica-eur-functional-tests.ts`) is organized into test suites:

1. **KYC Oracle Tests** - Tests for KYC Oracle initialization, user registration, and status updates.
2. **Token Functionality Tests** - Tests for token account creation, minting, and transfers.
3. **AML Authority Tests** - Tests for AML authority registration and blacklist creation.
4. **Freeze/Seize Functionality Tests** - Tests for freezing accounts and seizing tokens.

## Benefits of LiteSVM Tests

- **Faster Execution**: Tests run quickly without requiring a full Solana validator
- **No BPF Compilation**: No need to build BPF code, making tests more accessible
- **Simplified Testing**: Direct control over account state and simulated transactions
- **Reproducible Results**: Tests are deterministic and easy to debug

## Adding New Tests

When adding new tests:

1. Follow the existing patterns in the test file
2. Group related tests into appropriate describe blocks
3. Use descriptive test names that clearly explain what functionality is being tested
4. Make sure to test both happy path and error conditions

## Debugging Tests

To debug tests, you can add the `--inspect-brk` flag to the Node.js command:

```bash
node --inspect-brk --experimental-vm-modules node_modules/mocha/bin/mocha.js -p ./tsconfig.json -t 1000000 tests/mica-eur-functional-tests.ts
```

Then connect using Chrome DevTools or VS Code debugger.
