#!/bin/bash

# Run tests for MiCA EUR stablecoin
# Usage: ./scripts/run-tests.sh [--unit|--functional|--all] [--no-build] [--no-validator] [--regenerate-keypairs] [--file <test-file>]

set -e

# Default settings
TEST_TYPE="all"
BUILD=true
START_VALIDATOR=true
REGENERATE_KEYPAIRS=false
SPECIFIC_TEST_FILE=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --unit)
            TEST_TYPE="unit"
            shift
            ;;
        --functional)
            TEST_TYPE="functional"
            shift
            ;;
        --all)
            TEST_TYPE="all"
            shift
            ;;
        --no-build)
            BUILD=false
            shift
            ;;
        --no-validator)
            START_VALIDATOR=false
            shift
            ;;
        --regenerate-keypairs)
            REGENERATE_KEYPAIRS=true
            shift
            ;;
        --file)
            SPECIFIC_TEST_FILE="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: ./scripts/run-tests.sh [--unit|--functional|--all] [--no-build] [--no-validator] [--regenerate-keypairs] [--file <test-file>]"
            exit 1
            ;;
    esac
done

# Remove existing keypairs if regeneration is requested
if [[ "$REGENERATE_KEYPAIRS" == true ]]; then
    echo "🔄 Regenerating test keypairs..."
    rm -rf ./test-keypairs
fi

# Source environment variables
source scripts/set-env-vars.sh

# Set up local validator if needed
if [[ "$START_VALIDATOR" == true ]]; then
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
fi

# Build project if needed
if [[ "$BUILD" == true ]]; then
    echo "🔨 Building project..."
    # Copy IDL files if they don't exist
    if [ ! -d target/idl ]; then
        echo "📁 Creating IDL directory..."
        mkdir -p target/idl
        
        # Check if we have a sample IDL file to copy
        if [ -f tests/fixtures/mica_eur.json ]; then
            echo "📋 Copying IDL fixture..."
            cp tests/fixtures/mica_eur.json target/idl/mica_eur.json
        else
            echo "⚠️ No IDL fixture found. Creating minimal IDL..."
            # Create a minimal IDL file for testing
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
fi

echo "🧪 Running tests..."

# Run a specific test file if specified
if [ -n "$SPECIFIC_TEST_FILE" ]; then
    echo "🔬 Running specific test: $SPECIFIC_TEST_FILE"
    npx mocha -r ts-node/register "$SPECIFIC_TEST_FILE" --timeout 120000
# Run tests based on type
elif [ "$TEST_TYPE" == "unit" ]; then
    echo "📊 Running unit tests..."
    npx mocha -r ts-node/register 'tests/unit/**/*.ts' --timeout 60000
elif [ "$TEST_TYPE" == "functional" ]; then
    echo "🔄 Running functional tests..."
    npx mocha -r ts-node/register 'tests/functional/**/*.ts' --timeout 120000
else
    echo "🔬 Running all tests..."
    npx mocha -r ts-node/register 'tests/**/*.ts' --timeout 120000
fi

echo "✅ Tests completed successfully!" 