#!/usr/bin/env bash

set -e

# Script to run smoke tests without building the project
echo "🧪 Running smoke tests..."

# Source environment variables
if [ -f scripts/set-env-vars.sh ]; then
    echo "📥 Loading environment variables and test keypairs..."
    source scripts/set-env-vars.sh
elif [ -f .env ]; then
    echo "📥 Loading from .env file..."
    source .env
    
    # Generate test keypairs since they weren't created by set-env-vars.sh
    source scripts/generate-test-keypairs.sh
fi

# Set Solana to use local network if not already set
if ! solana config get | grep -q "localhost"; then
    echo "📡 Configuring Solana to use local network..."
    solana config set --url localhost
fi

# Check if local validator is running
if ! solana cluster-version &> /dev/null; then
    echo "🚀 Starting local validator..."
    solana-test-validator --no-bpf-jit --reset &
    
    # Give validator time to start
    echo "⏳ Waiting for validator to start..."
    sleep 5
    
    # Capture validator PID to kill it when script exits
    VALIDATOR_PID=$!
    trap "kill $VALIDATOR_PID 2>/dev/null" EXIT
else
    echo "✅ Local validator already running"
fi

# Create IDL directory and copy fixtures if needed
if [ ! -d target/idl ]; then
    echo "📁 Creating IDL directory..."
    mkdir -p target/idl
    
    if [ -f tests/fixtures/mica_eur.json ]; then
        echo "📋 Copying IDL fixture..."
        cp tests/fixtures/mica_eur.json target/idl/mica_eur.json
    else
        echo "⚠️ No IDL fixture found. Creating minimal IDL..."
        cat > target/idl/mica_eur.json << EOF
{
  "version": "0.1.0",
  "name": "mica_eur",
  "instructions": [],
  "accounts": [],
  "types": []
}
EOF
    fi
fi

# Run a specific test file or test suite
if [ -n "$1" ]; then
    TEST_FILE=$1
    echo "🔍 Running test: $TEST_FILE"
    npx mocha -r ts-node/register $TEST_FILE --timeout 120000
else
    # Run smoke tests
    echo "🔍 Running smoke tests..."
    npx mocha -r ts-node/register 'tests/unit/smoke.spec.ts' --timeout 60000
fi

echo "✅ Tests completed!" 