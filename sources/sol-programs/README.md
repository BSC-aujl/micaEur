# Solana Programs

This directory contains all the Solana programs (smart contracts) for the MiCA EUR project. 

## Structure

- `mica_eur/` - The main MiCA EUR stablecoin program
  - `src/` - Program source code
  - `tests/` - Collocated tests (unit, integration, e2e)

## Development

### Prerequisites

- Rust and Cargo
- Solana CLI
- Anchor Framework

### Building

```bash
# Build all programs
anchor build

# Build specific program
cd mica_eur
cargo build-bpf
```

### Testing

```bash
# Run all tests for a program
cd mica_eur
cargo test

# Run e2e tests
npm run test:functional
```

For more details on working with Anchor, see [ANCHOR_GUIDE.md](./ANCHOR_GUIDE.md). 