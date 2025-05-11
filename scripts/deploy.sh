#!/bin/bash
# Deploy script for the MiCA EUR project using Anchor
set -e

echo "=== MiCA EUR Deploy Script ==="

# Parse command line arguments
TARGET_NETWORK="localnet"
SKIP_BUILD=false
KEYPAIR_PATH=""

while [ $# -gt 0 ]; do
  case "$1" in
    --network|-n)
      TARGET_NETWORK="$2"
      shift 2
      ;;
    --skip-build|-s)
      SKIP_BUILD=true
      shift
      ;;
    --keypair|-k)
      KEYPAIR_PATH="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--network|-n NETWORK] [--skip-build|-s] [--keypair|-k PATH]"
      echo "  NETWORK: localnet, devnet, testnet, mainnet (default: localnet)"
      exit 1
      ;;
  esac
done

# Configure for the target network
echo "Configuring for $TARGET_NETWORK..."
if [ "$TARGET_NETWORK" = "localnet" ]; then
  ANCHOR_PROVIDER_URL="http://localhost:8899"
elif [ "$TARGET_NETWORK" = "devnet" ]; then
  ANCHOR_PROVIDER_URL="https://api.devnet.solana.com"
elif [ "$TARGET_NETWORK" = "testnet" ]; then
  ANCHOR_PROVIDER_URL="https://api.testnet.solana.com"
elif [ "$TARGET_NETWORK" = "mainnet" ]; then
  ANCHOR_PROVIDER_URL="https://api.mainnet-beta.solana.com"
else
  echo "Unknown network: $TARGET_NETWORK"
  exit 1
fi

# Set keypair if provided
if [ -n "$KEYPAIR_PATH" ]; then
  if [ -f "$KEYPAIR_PATH" ]; then
    echo "Using keypair: $KEYPAIR_PATH"
    export ANCHOR_WALLET="$KEYPAIR_PATH"
  else
    echo "Keypair file not found: $KEYPAIR_PATH"
    exit 1
  fi
else
  # Use default keypair path
  export ANCHOR_WALLET="$HOME/.config/solana/id.json"
fi

# Set provider URL
export ANCHOR_PROVIDER_URL="$ANCHOR_PROVIDER_URL"

# Check for sufficient funds (only for non-localnet)
if [ "$TARGET_NETWORK" != "localnet" ]; then
  BALANCE=$(solana balance | awk '{print $1}')
  if ! command -v bc &> /dev/null || (( $(echo "$BALANCE < 1.0" | bc -l 2>/dev/null || echo 1) )); then
    echo "Warning: Low balance ($BALANCE SOL) or cannot check balance. You may need more funds to deploy."
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo "Deployment cancelled."
      exit 1
    fi
  fi
else
  # For localnet, try to airdrop some SOL
  echo "Requesting airdrop for localnet testing..."
  solana airdrop 2 >/dev/null 2>&1 || true
fi

# Build the program if needed
if [ "$SKIP_BUILD" != true ]; then
  echo "Building program with Anchor..."
  anchor build
  
  if [ $? -ne 0 ]; then
    echo "Build failed. Deployment aborted."
    exit 1
  fi
fi

# Deploy the program using Anchor
echo "Deploying program to $TARGET_NETWORK..."
anchor deploy --provider.cluster $TARGET_NETWORK

echo "Deployment completed!" 