#!/bin/zsh
set -e

# Run cargo.lock check first
node scripts/check-lock-version.js

# Unset any existing RUSTUP_TOOLCHAIN
unset RUSTUP_TOOLCHAIN

# Clean up any proxy-related environment variables that might be causing issues
unset CARGO_HTTP_PROXY
unset CARGO_HTTPS_PROXY
unset CARGO_PROXY
unset HTTP_PROXY
unset HTTPS_PROXY
unset http_proxy
unset https_proxy
unset all_proxy
unset ALL_PROXY

# Display current Rust version
echo "Using Rust version:"
rustc --version

# Create the .cargo directory if it doesn't exist
mkdir -p ~/.cargo

# Check if config.toml exists
if [ -f ~/.cargo/config.toml ]; then
  echo "Found ~/.cargo/config.toml, backing it up..."
  mv ~/.cargo/config.toml ~/.cargo/config.toml.bak
fi

# Create a new config file that disables proxies
echo "Creating temporary cargo config..."
cat > ~/.cargo/config.toml << EOF
[http]
check-revoke = false
ssl-version = "tlsv1.3"

[build]
rustc-wrapper = ""

[net]
git-fetch-with-cli = true
EOF

# Clean previous build
echo "Cleaning previous build artifacts..."
rm -rf target/deploy/

# Create required directories
mkdir -p target/deploy
mkdir -p target/idl

# Always ensure Cargo.lock is version 3 if it exists
if [ -f Cargo.lock ]; then
  echo "Ensuring Cargo.lock is version 3..."
  sed -i '3s/^version = 4$/version = 3/' Cargo.lock
fi

# Build with explicit version
echo "Building with explicit toolchain..."
set +e
rustup run stable cargo build --release -p mica_eur -v
BUILD_RESULT=$?
set -e

# Restore original cargo config if it existed
if [ -f ~/.cargo/config.toml.bak ]; then
  echo "Restoring original cargo config..."
  mv ~/.cargo/config.toml.bak ~/.cargo/config.toml
fi

echo "Build process completed!"
find target -name "*.so" | grep -v incremental

# Exit with the build result
exit $BUILD_RESULT 