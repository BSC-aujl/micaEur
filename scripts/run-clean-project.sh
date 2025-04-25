#!/bin/bash
set -e

# A comprehensive script to clean, build, and test the project
# without proxy issues or other common problems

echo "=== MiCA EUR Clean Project Script ==="

# 1. Unset any problematic environment variables
unset RUSTUP_TOOLCHAIN
unset CARGO_HTTP_PROXY
unset CARGO_HTTPS_PROXY
unset CARGO_PROXY
unset HTTP_PROXY
unset HTTPS_PROXY
unset http_proxy
unset https_proxy
unset all_proxy
unset ALL_PROXY
unset CURSOR_CUSTOM_PROXY
unset RUST_LOG

# 2. Temporarily back up any existing cargo config
if [ -f ~/.cargo/config.toml ]; then
  echo "Backing up existing cargo config..."
  mv ~/.cargo/config.toml ~/.cargo/config.toml.bak
fi

# 3. Clean any previous build artifacts
echo "Cleaning previous build artifacts..."
rm -rf target/deploy
rm -rf test_build
rm -f Cargo.lock

# 4. Build the project
echo "Building the project..."
./scripts/build-no-proxy.sh

# 5. Run the tests
echo "Running tests..."
./scripts/run-fixed-tests.sh

# 6. Restore original cargo config if it existed
if [ -f ~/.cargo/config.toml.bak ]; then
  echo "Restoring original cargo config..."
  mv ~/.cargo/config.toml.bak ~/.cargo/config.toml
fi

echo "=== Project processed successfully ==="
echo "You can now use the following commands:"
echo "  - npm run build       # Build the project"
echo "  - npm run test        # Run basic tests"
echo "  - npm run test:all    # Run all tests" 