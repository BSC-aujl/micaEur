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
  
  # Install latest stable Rust (compatible with Anchor 0.31.1)
  echo "Installing latest stable Rust..."
  rustup install stable
  rustup default stable
  
  # Verify Rust version
  echo "Verifying Rust version:"
  rustc --version
fi

# Setup Solana
if [ "$SETUP_SOLANA" = true ]; then
  echo "Setting up Solana..."
  
  # Set Solana to 2.1.22 (compatible with Anchor 0.31.1)
  echo "Setting Solana to version 2.1.22..."
  sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
  
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
    echo "Installing Anchor 0.31.1..."
    avm install 0.31.1
    avm use 0.31.1
  else
    # Ensure correct version
    echo "Ensuring Anchor version 0.31.1..."
    avm install 0.31.1
    avm use 0.31.1
  fi
  
  # Verify Anchor version
  echo "Verifying Anchor version:"
  anchor --version
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