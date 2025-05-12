# Build Configuration Notes

## Anchor Build Fix

To successfully build the project with `anchor build`, the following configuration was found to work:

### Rust Toolchain

We use the Rust nightly toolchain, specifically:
```
rustc 1.89.0-nightly (ce7e97f73 2025-05-11)
cargo 1.89.0-nightly (056f5f4f3 2025-05-09)
```

This is configured in `rust-toolchain.toml`:
```toml
[toolchain]
channel = "nightly-2025-05-11" 
components = ["rustfmt", "clippy"]
targets = ["bpfel-unknown-none"]
profile = "minimal"
```

### Dependency Fixes

To resolve build issues, we need to pin certain dependencies to specific versions:

In `Anchor.toml`:
```toml
[dependencies]
proc-macro2 = "=1.0.94"
```

### Versions

The project is built with:
- Anchor CLI: 0.30.1
- Solana CLI: 1.18.17

## Troubleshooting

If you encounter build issues:

1. Ensure you're using the correct Rust toolchain
   ```
   rustup override set nightly-2025-05-11
   ```

2. Check that the dependency versions are correctly pinned in Anchor.toml

3. Clean your build artifacts before rebuilding
   ```
   rm -rf target/deploy
   rm -rf .anchor
   ```

4. Rebuild with 
   ```
   anchor build
   ``` 