# MiCA EUR - Anchor Guide

This guide explains how to work with the MiCA EUR project using Anchor, the standard framework for Solana program development.

## Prerequisites

Make sure you have the following installed:
- Rust (latest stable version)
- Solana CLI (2.1.22 or later)
- Anchor CLI (0.31.1 or later)
- Node.js (16 or later)

## Setup

The project includes a setup script that will prepare your environment:

```bash
# Install all dependencies
./scripts/setup.sh

# Install specific components
./scripts/setup.sh --rust    # Setup Rust
./scripts/setup.sh --solana  # Setup Solana
./scripts/setup.sh --anchor  # Setup Anchor
```

## Building the Program

Use the standard Anchor commands or our build script:

```bash
# Using Anchor directly (recommended)
anchor build

# Using our build script
./scripts/build.sh

# Building without BPF compilation (for test-only scenarios)
./scripts/build.sh --skip-bpf
```

## Testing

### Anchor Tests

We support Anchor's built-in testing framework:

```bash
# Run all tests using Anchor's testing framework
anchor test

# Run specific test filters
anchor test --filter "should initialize"
```

### Custom Tests

We also have custom test scripts for specific functionalities:

```bash
# Run functional tests with the test.sh script
./scripts/test.sh --functional

# Use Anchor's test framework
./scripts/test.sh --anchor

# Run specific test types
./scripts/test.sh --unit
./scripts/test.sh --integration
./scripts/test.sh --e2e

# To run tests with a local validator
./scripts/test.sh --validator
```

Additionally, specific functionality tests are available:

```bash
# KYC Oracle tests
npm run test:kyc

# Token functionality tests
npm run test:token

# AML tests
npm run test:aml

# Freeze/Seize functionality tests
npm run test:freeze-seize
```

## Deployment

Deploy your program using standard Anchor commands or our deploy script:

```bash
# Deploy using Anchor directly (recommended)
anchor deploy

# Deploy to specific network
anchor deploy --provider.cluster devnet

# Using our deploy script
./scripts/deploy.sh

# Deploy to specific network
./scripts/deploy.sh --network devnet
```

## Using the IDL

After building, the IDL will be available in `target/idl/mica_eur.json`. You can use this IDL with Anchor client libraries to interact with your program.

```typescript
import { Program } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { IDL } from "../target/types/mica_eur";

// Create a new program instance
const program = new Program(IDL, programId, provider);
```

## Troubleshooting

If you encounter issues:

1. Make sure all versions match between Rust, Solana, and Anchor
2. Check that your Anchor.toml has the correct configurations
3. Try rebuilding with a clean target directory:
   ```bash
   ./scripts/build.sh --clean
   ```
4. Ensure the Solana validator is running if your tests require it

## Recommended Workflow

For the best development experience with Anchor:

1. Build your program: `anchor build`
2. Run tests: `anchor test`
3. Deploy: `anchor deploy`
4. Use the generated TypeScript IDLs in your client applications

This workflow follows the standard Anchor development process and avoids custom script complexity. 