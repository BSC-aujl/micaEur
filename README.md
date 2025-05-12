# MiCA EUR Solana Program

This repository contains a Solana program for a regulatory-compliant EUR stablecoin implementation following the Markets in Crypto-Assets (MiCA) regulation framework.

## Features

- **KYC Oracle**: Implementation of a Know Your Customer (KYC) Oracle that verifies and maintains user status
- **Regulatory Compliance**: Built-in compliance with MiCA regulations for EUR-backed stablecoins
- **SPL Token Integration**: Leverages Solana's SPL Token 2022 standard for advanced token features

## Prerequisites

- Rust v1.68.0 or later
- Solana CLI v1.18.0 or later
- Anchor CLI v0.30.0 or later
- Node.js v16 or later (for client applications)

## Build Instructions

The project can be built using the provided build script:

```bash
# Build the project
./scripts/build.sh

# Clean previous build artifacts and rebuild
./scripts/build.sh --clean
```

### What the Build Script Does

The build script performs the following tasks:

1. Verifies the Cargo.lock version is correct (should be version 3)
2. Creates a stub `lib.rs` file in the project root if needed (required for Anchor's path resolution)
3. Cleans previous build artifacts if requested
4. Builds the program using Anchor

### Build Artifacts

After a successful build, the following artifacts are generated:

- `target/deploy/mica_eur.so` - The compiled program binary
- `target/deploy/mica_eur-keypair.json` - The program keypair
- `target/idl/mica_eur.json` - The IDL (Interface Description Language) file
- `target/types/mica_eur.ts` - TypeScript types for client development

## Project Structure

```
mica_eur/
├── .cargo/                    # Cargo configuration
├── docs/                      # Documentation
├── programs/                  # Solana programs
│   └── mica_eur/              # MiCA EUR program
│       ├── src/               # Source code
│       │   ├── lib.rs         # Main program entry point
│       │   ├── kyc_oracle.rs  # KYC oracle implementation
│       │   ├── merkle_info.rs # Merkle tree implementation
│       │   ├── mint_utils.rs  # Minting utilities
│       │   └── versions.rs    # Version management
│       └── Cargo.toml         # Program dependencies
├── scripts/                   # Build and utility scripts
│   └── build.sh               # Build script
├── Anchor.toml                # Anchor configuration
├── Cargo.toml                 # Workspace dependencies
└── README.md                  # Project documentation
```

## Development

### Key Components

1. **KYC Oracle**: Manages user verification status, essential for regulatory compliance
2. **SPL Token 2022**: Uses Solana's enhanced token standard for advanced functionality
3. **Mint Management**: Controls the minting and burning of the stablecoin with appropriate permissions

### Client Integration

To integrate with a client application, use the generated IDL file and TypeScript types:

```typescript
import { Program } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { MicaEur } from '../target/types/mica_eur';
import idl from '../target/idl/mica_eur.json';

// Initialize the program
const programId = new PublicKey('your_program_id_here');
const program = new Program(idl, programId) as Program<MicaEur>;

// Call program instructions
const tx = await program.methods
  .registerKycUser(userInfo)
  .accounts({
    // required accounts
  })
  .rpc();
```

## Documentation

For more detailed documentation, see:

- [Anchor Build Fix](docs/anchor-build-fix.md) - Documentation on fixing Anchor build issues

## License

[Add your license information here]
