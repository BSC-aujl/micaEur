#!/usr/bin/env bash

set -e

# Script to generate temporary test keypairs for the test environment
# instead of using the default Solana wallet

# Create temp directory for keypairs if it doesn't exist
KEYPAIR_DIR="./test-keypairs"
mkdir -p $KEYPAIR_DIR

# Generate payer keypair if it doesn't exist
PAYER_KEYPAIR="$KEYPAIR_DIR/payer.json"
if [ ! -f "$PAYER_KEYPAIR" ]; then
    echo "🔑 Generating new payer keypair..."
    solana-keygen new --no-bip39-passphrase -o "$PAYER_KEYPAIR" --force > /dev/null 2>&1
else
    echo "🔑 Using existing payer keypair"
fi

# Generate test user keypairs
for i in {1..3}; do
    USER_KEYPAIR="$KEYPAIR_DIR/user$i.json"
    if [ ! -f "$USER_KEYPAIR" ]; then
        echo "🔑 Generating test user $i keypair..."
        solana-keygen new --no-bip39-passphrase -o "$USER_KEYPAIR" --force > /dev/null 2>&1
    fi
done

# Generate authority keypair for smart contract
AUTHORITY_KEYPAIR="$KEYPAIR_DIR/authority.json"
if [ ! -f "$AUTHORITY_KEYPAIR" ]; then
    echo "🔑 Generating authority keypair..."
    solana-keygen new --no-bip39-passphrase -o "$AUTHORITY_KEYPAIR" --force > /dev/null 2>&1
fi

# Fund the payer keypair if needed
echo "💰 Funding payer keypair..."
PAYER_PUBKEY=$(solana-keygen pubkey "$PAYER_KEYPAIR")
BALANCE=$(solana balance "$PAYER_PUBKEY" 2>/dev/null || echo "0 SOL")

if [[ "$BALANCE" == "0 SOL" ]]; then
    echo "🚀 Requesting airdrop for payer keypair..."
    solana airdrop 2 "$PAYER_PUBKEY" || {
        echo "⚠️ Airdrop failed. If using mainnet or testnet, fund the keypair manually."
    }
else
    echo "💸 Payer keypair already has balance: $BALANCE"
fi

# Export wallet paths (to be sourced by other scripts)
export TEST_PAYER_KEYPAIR="$PAYER_KEYPAIR"
export TEST_AUTHORITY_KEYPAIR="$AUTHORITY_KEYPAIR"
export TEST_USER1_KEYPAIR="$KEYPAIR_DIR/user1.json"
export TEST_USER2_KEYPAIR="$KEYPAIR_DIR/user2.json"
export TEST_USER3_KEYPAIR="$KEYPAIR_DIR/user3.json"

# Print keypair information
echo "✅ Test keypairs generated and ready"
echo "Payer: $(solana-keygen pubkey "$PAYER_KEYPAIR")"
echo "Authority: $(solana-keygen pubkey "$AUTHORITY_KEYPAIR")"
echo "User1: $(solana-keygen pubkey "$TEST_USER1_KEYPAIR")"
echo "User2: $(solana-keygen pubkey "$TEST_USER2_KEYPAIR")"
echo "User3: $(solana-keygen pubkey "$TEST_USER3_KEYPAIR")" 