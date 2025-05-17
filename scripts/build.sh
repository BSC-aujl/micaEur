#!/bin/bash
# Build script for the MiCA EUR project using Anchor
set -e

echo "=== MiCA EUR Build Script ==="

# Check for stub lib.rs file in project root (required for Anchor path lookup)
if [ ! -f "./lib.rs" ]; then
  echo "Creating stub lib.rs file in project root to fix Anchor path lookup..."
  cat > lib.rs << EOF
// This is a stub lib.rs file in the project root
// It's required to satisfy Anchor's path lookup during the build process
// The actual program code is in sources/sol-programs/mica_eur/src/lib.rs

pub fn dummy() {}
EOF
  echo "✅ Created stub lib.rs file"
fi

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

# Clean previous build if requested
if [ "$1" == "--clean" ] || [ "$1" == "-c" ]; then
  echo "Cleaning previous build artifacts..."
  cargo clean
  rm -rf target/deploy/
  rm -rf target/idl/
  rm -rf .anchor/
fi

# Create target dirs if needed
mkdir -p target/deploy
mkdir -p target/idl

# Build with Anchor
echo "Building with Anchor..."
ANCHOR_BUILD_FLAGS=""
if [ "$1" == "--skip-lint" ]; then
  ANCHOR_BUILD_FLAGS="--skip-lint"
  # Skip TypeScript linting but run Rust checks
  echo "Skipping TypeScript linting but still checking Rust code..."
  node scripts/verify-rust.js
else
  # Run Rust verification with Cargo only on Rust files
  echo "Verifying Rust sources..."
  node scripts/verify-rust.js
fi

anchor build $ANCHOR_BUILD_FLAGS
BUILD_RESULT=$?

if [ $BUILD_RESULT -eq 0 ]; then
  echo "✅ Anchor build successful!"
  
  # Generate IDL if not already generated
  if [ ! -f "target/idl/mica_eur.json" ]; then
    echo "Generating IDL file..."
    if [ -f "./scripts/extract-idl.js" ]; then
      node scripts/extract-idl.js
    fi
  fi
  
  echo "Build process completed!"
else
  echo "❌ Anchor build failed with exit code: $BUILD_RESULT"
  if [ -f "./scripts/extract-idl.js" ]; then
    echo "Generating minimal IDL for development..."
    node scripts/extract-idl.js
    echo "You can still use the minimal IDL for client development."
  fi
  exit $BUILD_RESULT
fi 