#!/bin/bash

# Set up Solana test validator and environment variables for testing
echo "Setting up Solana test environment..."

# Default to localhost if not specified
export ANCHOR_PROVIDER_URL=${ANCHOR_PROVIDER_URL:-"http://localhost:8899"}

# Check if solana-test-validator is running
if ! pgrep -f "solana-test-validator" > /dev/null; then
    echo "Starting solana-test-validator in background..."
    # Start validator in the background with reduced logging
    solana-test-validator --quiet --reset > /dev/null 2>&1 &
    VALIDATOR_PID=$!
    
    # Save the PID for later cleanup
    echo $VALIDATOR_PID > /tmp/solana-validator-pid.txt
    
    # Wait for validator to start up
    echo "Waiting for validator to start..."
    sleep 5
else
    echo "solana-test-validator is already running."
fi

# Set up wallet for testing
if [ -z "$ANCHOR_WALLET" ]; then
    # If no wallet is specified, create a temporary one
    TEMP_WALLET="$HOME/.config/solana/id.json"
    
    if [ ! -f "$TEMP_WALLET" ]; then
        echo "Creating temporary wallet..."
        # Create a test wallet without a passphrase
        solana-keygen new --no-bip39-passphrase --outfile "$TEMP_WALLET" --force
    fi
    
    export ANCHOR_WALLET="$TEMP_WALLET"
    echo "Using wallet at $ANCHOR_WALLET"
    
    # Airdrop some SOL to the test wallet if needed
    BALANCE=$(solana balance)
    if [[ $BALANCE == "0 SOL" ]]; then
        echo "Airdropping 10 SOL to test wallet..."
        solana airdrop 10 > /dev/null 2>&1
    fi
fi

# Build the program if needed
if [ "$1" == "--build" ]; then
    echo "Building program..."
    anchor build
fi

echo "Test environment is ready!" 