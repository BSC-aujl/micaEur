# Anchor Guide

Guide for working with Anchor in the MiCA EUR project.

## Prerequisites

Make sure you have the following installed:
- Rust nightly-2025-05-11
- Solana CLI v1.18.17
- Anchor CLI v0.30.1
- Node.js v16+

## Setup

The project includes a setup script for your environment:

```bash
# Install all dependencies
./scripts/setup.sh

# Install specific components
./scripts/setup.sh --rust    # Setup Rust nightly-2025-05-11
./scripts/setup.sh --solana  # Setup Solana v1.18.17
./scripts/setup.sh --anchor  # Setup Anchor v0.30.1
```

## Building

```bash
# Using Anchor directly (recommended)
anchor build

# Using the build script
./scripts/build.sh

# Building without BPF compilation (for test-only scenarios)
./scripts/build.sh --skip-bpf
```

## Testing

### Anchor Tests

```bash
# Run all tests using Anchor's testing framework
anchor test

# Run specific test filters
anchor test --filter "should initialize"
```

### Custom Tests

```bash
# Run functional tests
./scripts/test.sh --functional

# Run specific test types
./scripts/test.sh --unit
./scripts/test.sh --integration
./scripts/test.sh --e2e

# To run tests with a local validator
./scripts/test.sh --validator
```

## Deployment

```bash
# Deploy using Anchor directly
anchor deploy

# Deploy to specific network
anchor deploy --provider.cluster devnet

# Using the deploy script
./scripts/deploy.sh

# Deploy to specific network
./scripts/deploy.sh --network devnet
```

## Using the IDL

After building, the IDL will be available in `target/idl/mica_eur.json`:

```typescript
import { Program } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { IDL } from "../target/types/mica_eur";

// Create a new program instance
const program = new Program(IDL, programId, provider);
```

## Troubleshooting

If you encounter issues:

1. Make sure all versions match the required ones:
   - Rust nightly-2025-05-11
   - Solana CLI v1.18.17
   - Anchor CLI v0.30.1

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