#!/usr/bin/env bash

# Set environment variables for testing

# Generate test keypairs if needed
if [ ! -f "./test-keypairs/payer.json" ]; then
    echo "🔑 Generating test keypairs..."
    source scripts/generate-test-keypairs.sh
else
    echo "🔑 Loading existing test keypairs..."
    # Export wallet paths
    export TEST_PAYER_KEYPAIR="./test-keypairs/payer.json"
    export TEST_AUTHORITY_KEYPAIR="./test-keypairs/authority.json"
    export TEST_USER1_KEYPAIR="./test-keypairs/user1.json"
    export TEST_USER2_KEYPAIR="./test-keypairs/user2.json"
    export TEST_USER3_KEYPAIR="./test-keypairs/user3.json"
fi

# Set Solana network to localhost
export ANCHOR_PROVIDER_URL=http://localhost:8899
echo "🌐 Set ANCHOR_PROVIDER_URL=$ANCHOR_PROVIDER_URL"

# Use the test payer keypair instead of default wallet
export ANCHOR_WALLET=$TEST_PAYER_KEYPAIR
echo "🔑 Set ANCHOR_WALLET=$ANCHOR_WALLET"

# Set program ID if known
if [ -f target/deploy/mica_eur-keypair.json ]; then
    PROGRAM_ID=$(solana-keygen pubkey target/deploy/mica_eur-keypair.json)
    export MICA_EUR_PROGRAM_ID=$PROGRAM_ID
    echo "📝 Set MICA_EUR_PROGRAM_ID=$PROGRAM_ID"
fi

# Set keypair public keys as environment variables for tests
export TEST_PAYER_PUBKEY=$(solana-keygen pubkey "$TEST_PAYER_KEYPAIR")
export TEST_AUTHORITY_PUBKEY=$(solana-keygen pubkey "$TEST_AUTHORITY_KEYPAIR")
export TEST_USER1_PUBKEY=$(solana-keygen pubkey "$TEST_USER1_KEYPAIR")
export TEST_USER2_PUBKEY=$(solana-keygen pubkey "$TEST_USER2_KEYPAIR")
export TEST_USER3_PUBKEY=$(solana-keygen pubkey "$TEST_USER3_KEYPAIR")

# Print status
echo "✅ Environment variables set for testing with isolated test keypairs" 