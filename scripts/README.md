# MiCA EUR Project Scripts

This directory contains simplified scripts for managing the MiCA EUR project. The scripts are designed to be simple, maintainable, and easy to use.

## Core Scripts

1. **setup.sh** - Sets up the development environment
   ```bash
   # Setup everything (default)
   ./scripts/setup.sh
   
   # Setup specific components
   ./scripts/setup.sh --rust    # Setup Rust 1.69.0
   ./scripts/setup.sh --solana  # Setup Solana 1.18.17
   ./scripts/setup.sh --anchor  # Verify Anchor 0.30.1
   ./scripts/setup.sh --env     # Setup environment variables
   ./scripts/setup.sh --keys    # Generate keypairs
   ```

2. **build.sh** - Builds the Solana program
   ```bash
   # Attempt to build with Anchor first, fallback to minimal IDL
   ./scripts/build.sh
   
   # Skip BPF compilation and create minimal IDL
   ./scripts/build.sh --skip-bpf
   ```

3. **test.sh** - Runs tests
   ```bash
   # Run smoke tests (default)
   ./scripts/test.sh
   
   # Run specific test types
   ./scripts/test.sh --smoke        # Run smoke tests
   ./scripts/test.sh --unit         # Run unit tests
   ./scripts/test.sh --integration  # Run integration tests
   ./scripts/test.sh --e2e          # Run end-to-end tests
   ./scripts/test.sh --all          # Run all tests
   
   # Additional options
   ./scripts/test.sh --validator    # Start local validator for tests
   ./scripts/test.sh --timeout 120000  # Set custom timeout
   ```

4. **deploy.sh** - Deploys the program
   ```bash
   # Deploy to localnet (default)
   ./scripts/deploy.sh
   
   # Deploy to specific network
   ./scripts/deploy.sh --network devnet
   ./scripts/deploy.sh --network testnet
   ./scripts/deploy.sh --network mainnet
   
   # Additional options
   ./scripts/deploy.sh --skip-build       # Skip build step
   ./scripts/deploy.sh --keypair KEY_PATH # Use specific keypair
   ```

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
npm run build:skip-bpf  # Build without BPF

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

## Support Scripts

- **check-lock-version.js** - Checks the version of Cargo.lock

The **deprecated** directory contains legacy scripts that were consolidated into the main scripts or are no longer used. 