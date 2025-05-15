#!/bin/bash
# Simple setup script for the MiCA EUR project
set -e

echo "=== MiCA EUR Setup Script ==="

# Parse command line arguments
SETUP_RUST=false
SETUP_SOLANA=false
SETUP_ANCHOR=false
SETUP_ENV=false
SETUP_KEYS=false
SETUP_ALL=false

if [ $# -eq 0 ]; then
  SETUP_ALL=true
fi

while [ $# -gt 0 ]; do
  case "$1" in
    --rust|-r)
      SETUP_RUST=true
      shift
      ;;
    --solana|-s)
      SETUP_SOLANA=true
      shift
      ;;
    --anchor|-a)
      SETUP_ANCHOR=true
      shift
      ;;
    --env|-e)
      SETUP_ENV=true
      shift
      ;;
    --keys|-k)
      SETUP_KEYS=true
      shift
      ;;
    --all)
      SETUP_ALL=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--rust|-r] [--solana|-s] [--anchor|-a] [--env|-e] [--keys|-k] [--all]"
      exit 1
      ;;
  esac
done

if [ "$SETUP_ALL" = true ]; then
  SETUP_RUST=true
  SETUP_SOLANA=true
  SETUP_ANCHOR=true
  SETUP_ENV=true
  SETUP_KEYS=true
fi

# Setup Rust
if [ "$SETUP_RUST" = true ]; then
  echo "Setting up Rust..."
  
  # Install Rust nightly
  echo "Installing Rust nightly-2025-05-11..."
  rustup install nightly-2025-05-11
  rustup default nightly-2025-05-11
  rustup component add rustfmt clippy --toolchain nightly-2025-05-11
  rustup target add bpfel-unknown-none --toolchain nightly-2025-05-11
  
  # Create or update rust-toolchain.toml
  cat > rust-toolchain.toml << EOF
[toolchain]
channel = "nightly-2025-05-11" 
components = ["rustfmt", "clippy"]
targets = ["bpfel-unknown-none"]
profile = "minimal"
EOF
  
  # Set for this directory
  rustup override set nightly-2025-05-11
  
  # Verify Rust version
  echo "Verifying Rust version:"
  rustc --version
fi

# Setup Solana
if [ "$SETUP_SOLANA" = true ]; then
  echo "Setting up Solana..."
  
  # Set Solana to 1.18.17
  echo "Setting Solana to version 1.18.17..."
  sh -c "$(curl -sSfL https://release.solana.com/v1.18.17/install)"
  
  # Verify Solana version
  echo "Verifying Solana version:"
  solana --version
fi

# Setup Anchor
if [ "$SETUP_ANCHOR" = true ]; then
  echo "Setting up Anchor..."
  
  # Check if Anchor is installed
  if ! command -v anchor &> /dev/null; then
    echo "Anchor not found. Installing Anchor..."
    echo "Installing AVM (Anchor Version Manager)..."
    cargo install --git https://github.com/coral-xyz/anchor avm --force
    echo "Installing Anchor 0.30.1..."
    avm install 0.30.1
    avm use 0.30.1
  else
    # Ensure correct version
    echo "Ensuring Anchor version 0.30.1..."
    avm install 0.30.1
    avm use 0.30.1
  fi
  
  # Verify Anchor version
  echo "Verifying Anchor version:"
  anchor --version
  
  # Update Anchor.toml dependency if needed
  if grep -q "\[dependencies\]" Anchor.toml; then
    # Section exists, check if proc-macro2 is already pinned
    if ! grep -q "proc-macro2" Anchor.toml; then
      # Add proc-macro2 entry
      sed -i '/\[dependencies\]/a proc-macro2 = "=1.0.94"' Anchor.toml
    fi
  else
    # Add section and dependency
    echo -e "\n[dependencies]\nproc-macro2 = \"=1.0.94\"" >> Anchor.toml
  fi
fi

# Setup environment variables
if [ "$SETUP_ENV" = true ]; then
  echo "Setting up environment variables..."
  
  # Check if initialize-dotenv.js exists
  if [ -f "./scripts/initialize-dotenv.js" ]; then
    node scripts/initialize-dotenv.js
  else
    echo "Creating basic .env file..."
    if [ ! -f ".env" ]; then
      cat > .env << EOF
# Environment configuration
SOLANA_NETWORK=localnet
RPC_URL=http://localhost:8899
PROGRAM_ID=ERASZWkbGZcWtWXrXfVnwPM8U5fEsTJR5GBvFcZFhU9t
EOF
    fi
  fi
fi

# Setup test keys
if [ "$SETUP_KEYS" = true ]; then
  echo "Setting up test keys..."
  
  # Check if generate-test-keys.js exists
  if [ -f "./scripts/generate-test-keys.js" ]; then
    node scripts/generate-test-keys.js
  else
    echo "Creating test keypair directory..."
    mkdir -p ./test-keypairs
    
    # Generate a basic keypair if solana is available
    if command -v solana &> /dev/null; then
      echo "Generating test keypair..."
      solana-keygen new --no-bip39-passphrase -o ./test-keypairs/test-keypair.json
    else
      echo "Solana CLI not available. Skipping keypair generation."
    fi
  fi
fi

echo "Setup completed successfully!" 