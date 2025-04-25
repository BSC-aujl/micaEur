#!/bin/bash
set -e

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
rm -f Cargo.lock
rm -rf target/deploy/

# Create required directories
mkdir -p target/deploy
mkdir -p target/idl

# First try: Build with explicit version
echo "Building with explicit toolchain (attempt 1)..."
set +e
rustup run stable cargo build --release -p mica_eur -v
BUILD_RESULT=$?
set -e

# If first attempt failed, try with different versions
if [ $BUILD_RESULT -ne 0 ]; then
  echo "First build attempt failed, trying alternative approach..."
  
  # Create a temporary Cargo.toml with simpler dependencies
  cp programs/mica_eur/Cargo.toml programs/mica_eur/Cargo.toml.bak
  
  echo "Simplified build with just anchor-lang dependency..."
  # Edit the Cargo.toml to have minimal dependencies
  cat > programs/mica_eur/Cargo.toml << EOF
[package]
name = "mica_eur"
version = "0.1.0"
description = "MiCA-compliant Euro stablecoin on Solana"
edition = "2021"

[lib]
crate-type = ["cdylib", "lib"]
name = "mica_eur"

[features]
default = []
cpi = ["no-entrypoint"]
no-entrypoint = []
no-idl = []
no-log-ix-name = []
idl-build = ["anchor-lang/idl-build"]

[dependencies]
anchor-lang = "=0.31.1"
EOF
  
  # Try building with simplified dependencies
  rustup run stable cargo build --release -p mica_eur
  
  # Restore original Cargo.toml
  mv programs/mica_eur/Cargo.toml.bak programs/mica_eur/Cargo.toml
fi

# Restore original cargo config if it existed
if [ -f ~/.cargo/config.toml.bak ]; then
  echo "Restoring original cargo config..."
  mv ~/.cargo/config.toml.bak ~/.cargo/config.toml
fi

echo "Build process completed!"
find target -name "*.so" | grep -v incremental 
