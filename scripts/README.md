# Scripts Directory

Utility scripts for building, testing, and deploying the MiCA EUR stablecoin.

## Setup Scripts

- **setup.sh** - Main setup script for installing dependencies
  ```bash
  ./setup.sh                # Install all dependencies
  ./setup.sh --rust         # Install Rust nightly-2025-05-11
  ./setup.sh --solana       # Install Solana v1.18.17
  ./setup.sh --anchor       # Install Anchor v0.30.1
  ./setup.sh --env          # Setup environment variables
  ./setup.sh --keys         # Generate test keypairs
  ```

## Build Scripts

- **build.sh** - Main build script
  ```bash
  ./build.sh                # Build the program
  ./build.sh --clean        # Clean and rebuild
  ./build.sh --skip-lint    # Build without linting (fast build)
  ```

- **check-lock-version.js** - Verify Cargo.lock version
- **extract-idl.js** - Extract IDL from compiled program
- **generate-idl.sh** - Generate and format IDL files

### Build Configuration

The build scripts ensure that the correct versions and configurations are used:

#### Required Toolchain

The project uses a specific Rust toolchain:
```
rustc 1.89.0-nightly (ce7e97f73 2025-05-11)
cargo 1.89.0-nightly (056f5f4f3 2025-05-09)
```

This is configured in `rust-toolchain.toml`.

#### Common Build Issues and Fixes

1. **Missing `lib.rs` in Project Root**

   Anchor looks for a `lib.rs` file in the project root directory, while the actual program code is in `programs/mica_eur/src/lib.rs`.

   **Solution**: The build script automatically creates a stub `lib.rs` file in the project root.

2. **Multiple Versions of Borsh**

   **Solution**: Pin the `borsh` version in `Cargo.toml` to `0.10.4`.

3. **Incorrect Cargo.lock Version**

   **Solution**: Ensure Cargo.lock is at version 3.

#### Troubleshooting Build Issues

If you encounter build issues:

1. Check the Rust toolchain:
   ```bash
   rustup override set nightly-2025-05-11
   ```

2. Verify dependency versions in Anchor.toml

3. Clean and rebuild:
   ```bash
   rm -rf target/deploy
   rm -rf .anchor
   ./scripts/build.sh --clean
   ```

## Test Scripts

- **test.sh** - Main test runner
  ```bash
  ./test.sh --functional    # Run functional tests
  ./test.sh --anchor        # Run Anchor tests
  ./test.sh --unit          # Run unit tests
  ./test.sh --integration   # Run integration tests
  ./test.sh --e2e           # Run end-to-end tests
  ./test.sh --validator     # Run tests with a local validator
  ```

- **run-functional-tests.sh** - Run all functional tests
- **run-kyc-tests.sh** - Run KYC Oracle tests
- **run-token-tests.sh** - Run token functionality tests
- **run-aml-tests.sh** - Run AML authority tests
- **run-freeze-seize-tests.sh** - Run freeze/seize tests
- **run-kyc-end-to-end-test.sh** - Run KYC end-to-end tests
- **run-jest-tests.sh** - Run Jest tests
- **run-precommit-tests.sh** - Run pre-commit tests
- **test-precommit.sh** - Test pre-commit hooks

## Deployment Scripts

- **deploy.sh** - Deploy the program
  ```bash
  ./deploy.sh               # Deploy to local validator
  ./deploy.sh --network devnet # Deploy to devnet
  ```

## Utility Scripts

- **verify-kyc-levels.js** - Verify KYC level configuration

## NPM Scripts

For convenience, these scripts are available through npm commands:

```bash
# Setup
npm run setup           # Setup environment
npm run setup:rust      # Setup Rust only
npm run setup:solana    # Setup Solana only
npm run setup:anchor    # Setup Anchor only
npm run setup:env       # Setup env vars only
npm run setup:keys      # Setup test keys only

# Build
npm run build           # Build program
npm run build:fast      # Fast build (skip linting)

# Test
npm run test            # Run all tests
npm run test:smoke      # Run smoke tests
npm run test:unit       # Run unit tests
npm run test:integration # Run integration tests
npm run test:e2e        # Run e2e tests
npm run test:with-validator # Run tests with validator

# Deploy
npm run deploy          # Deploy to localnet
npm run deploy:devnet   # Deploy to devnet
npm run deploy:testnet  # Deploy to testnet
npm run deploy:mainnet  # Deploy to mainnet

# Utility
npm run clean           # Clean artifacts
npm run validator       # Start local validator
```

The **deprecated** directory contains legacy scripts that were consolidated into the main scripts or are no longer used. 