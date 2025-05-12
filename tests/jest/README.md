# MiCA EUR Jest Tests

This directory contains Jest tests for the MiCA EUR program. These tests are designed to validate the deployed program on a local or remote Solana network.

## Test Files

- `mica-eur.test.ts`: Simple test that verifies the program exists and is executable.
- `mica-eur-full.test.ts`: More comprehensive test that initializes the Anchor Program and tests some of the program's functionality.

## Running the Tests

### Prerequisites

1. Make sure you have the MiCA EUR program deployed to a local validator
2. Ensure you have the IDL file available at `target/idl/mica_eur.json`

### Running All Tests

```bash
npm run test:jest
```

### Running Only the Full Tests

```bash
npm run test:jest:full
```

## Adding New Tests

When adding new tests, follow these guidelines:

1. Use the `mica-eur-full.test.ts` as a template for new test files
2. Make sure to properly initialize the Anchor Program
3. Use the correct PDA seeds for account derivation
4. Fund test accounts via airdrop before testing

## Troubleshooting

- If you encounter errors with the Program constructor, check the order of parameters
- If account tests fail, verify the PDA seeds match what's in the program
- If you cannot find accounts, ensure the program ID is correct 