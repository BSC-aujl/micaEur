# Anchor Build Fix

## Problem

The Anchor build process was failing with this error:
```
error: proc-macro derive panicked
lib.rs should exist: Path ("/home/axel/solana-hackathon/mica_eur") not found
```

This was happening because Anchor was looking for a `lib.rs` file directly in the project root directory, but the actual program code was in the Anchor workspace at `programs/mica_eur/src/lib.rs`.

## Issues and Solutions

### 1. Missing `lib.rs` in Project Root

The Anchor CLI was looking for a `lib.rs` file in the wrong location during the build process. 

**Solution:**
Create a stub `lib.rs` file in the project root to satisfy Anchor's path lookup requirements. This is handled automatically in the build script.

### 2. Multiple Versions of Borsh

Multiple incompatible versions of the `borsh` library were causing conflicts.

**Solution:**
Pin the `borsh` version in `Cargo.toml` to `0.10.4` to ensure consistent serialization behavior.

### 3. Incorrect Cargo.lock Version

The `Cargo.lock` file was at version 4, which was incompatible.

**Solution:**
Downgrade the Cargo.lock version to 3.

## Build Process

After applying these fixes, the build process now works correctly:

1. Run `./scripts/build.sh [--clean]` to build the project
   - The script will check for the existence of a stub `lib.rs` file and create it if needed
   - It will verify the Cargo.lock version
   - It will clean previous build artifacts if the `--clean` flag is provided
   - Finally, it will build the project with Anchor

2. Build artifacts are generated in the following locations:
   - `target/deploy/mica_eur.so` - The compiled program binary
   - `target/deploy/mica_eur-keypair.json` - The program keypair
   - `target/idl/mica_eur.json` - The IDL (Interface Description Language) file
   - `target/types/mica_eur.ts` - TypeScript types for client development

## Generated Artifacts

The successful build produces:

1. **Program Binary (`mica_eur.so`)**: The compiled Solana program that can be deployed to the blockchain.

2. **Program Keypair (`mica_eur-keypair.json`)**: Contains the program's public/private key pair used to identify the program on-chain.

3. **IDL File (`mica_eur.json`)**: A JSON file that describes the program's interface:
   - Program instructions (functions that can be called)
   - Account structures (data stored on-chain)
   - Custom types and enums
   - The program ID (derived from the keypair)

4. **TypeScript Types (`mica_eur.ts`)**: Generated TypeScript definitions that can be used in client applications to interact with the program.

## Using the IDL for Client Development

The IDL file can be used to generate client-side code for interacting with the Solana program. It provides:

- Instruction definitions with their required accounts and arguments
- Account structure definitions with their fields and types
- Custom type definitions
- The program ID

Client libraries like Anchor's JavaScript/TypeScript SDK can use this IDL to provide type-safe interactions with the program. 