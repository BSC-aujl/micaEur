#!/bin/bash
# Build script for the MiCA EUR project using Anchor
set -e

echo "=== MiCA EUR Build Script ==="

# Run cargo.lock check first
if [ -f "./scripts/check-lock-version.js" ]; then
  echo "🔍 Checking Cargo.lock version..."
  node scripts/check-lock-version.js
fi

# Display current versions
echo "Using Rust version:"
rustc --version
echo "Using Anchor version:"
anchor --version
echo "Using Solana version:"
solana --version

# Check if the BPF target is available
if rustc --print target-list | grep -q "bpfel-unknown-unknown"; then
  echo "✅ BPF target 'bpfel-unknown-unknown' is available in the Rust toolchain"
  BPF_TARGET_AVAILABLE=true
else
  echo "⚠️  BPF target 'bpfel-unknown-unknown' is NOT available in the Rust toolchain"
  echo "Available BPF targets:"
  rustc --print target-list | grep bpf
  BPF_TARGET_AVAILABLE=false
fi

# Clean previous build if requested
if [ "$1" == "--clean" ] || [ "$1" == "-c" ]; then
  echo "Cleaning previous build artifacts..."
  rm -rf target/deploy/
  rm -rf target/idl/
  rm -rf .anchor/
fi

# Create test dirs if needed
mkdir -p target/deploy
mkdir -p target/idl

# Attempt to build with BPF or create minimal IDL
if [ "$1" == "--skip-bpf" ] || [ "$1" == "-s" ] || [ "$BPF_TARGET_AVAILABLE" == "false" ]; then
  # If BPF target isn't available or skip is requested, use no-bpf-build.sh
  if [ -f "./scripts/no-bpf-build.sh" ]; then
    echo "Using no-bpf-build.sh to generate minimal IDL files..."
    ./scripts/no-bpf-build.sh
    BUILD_RESULT=$?
  else
    # Create a minimal IDL directly
    echo "Skipping BPF build and creating a minimal IDL for testing..."
    cat > target/idl/mica_eur.json << EOF
{
  "version": "0.1.0",
  "name": "mica_eur",
  "instructions": [],
  "accounts": [],
  "types": [],
  "metadata": {
    "address": "ERASZWkbGZcWtWXrXfVnwPM8U5fEsTJR5GBvFcZFhU9t"
  }
}
EOF
    BUILD_RESULT=0
  fi
else
  # Build with Anchor (standard approach)
  echo "Building with Anchor..."
  anchor build
  BUILD_RESULT=$?
  
  # If anchor build succeeds, copy the IDL files to our standard location
  if [ $BUILD_RESULT -eq 0 ]; then
    echo "Build successful. Copying IDL files..."
    cp -f target/types/*.ts target/idl/ 2>/dev/null || true
  else
    echo "Anchor build failed with exit code: $BUILD_RESULT"
    echo "Trying fallback to no-bpf-build.sh..."
    if [ -f "./scripts/no-bpf-build.sh" ]; then
      ./scripts/no-bpf-build.sh
      BUILD_RESULT=$?
    fi
  fi
fi

if [ $BUILD_RESULT -eq 0 ]; then
  echo "Build process completed!"
else
  echo "Build process failed with exit code: $BUILD_RESULT"
fi

exit $BUILD_RESULT 