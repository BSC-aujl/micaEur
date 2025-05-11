#!/bin/bash
# Test script for the MiCA EUR project using Anchor
set -e

echo "=== MiCA EUR Test Script ==="

# Parse command line arguments
TEST_TYPE="functional"
START_VALIDATOR=false
VERBOSE=false
TIMEOUT=60000
SPECIFIC_TEST=""
USE_ANCHOR=false

while [ $# -gt 0 ]; do
  case "$1" in
    --functional|-f)
      TEST_TYPE="functional"
      shift
      ;;
    --anchor|-a)
      USE_ANCHOR=true
      shift
      ;;
    --unit|-u)
      TEST_TYPE="unit"
      shift
      ;;
    --integration|-i)
      TEST_TYPE="integration"
      shift
      ;;
    --e2e|-e)
      TEST_TYPE="e2e"
      shift
      ;;
    --validator|-v)
      START_VALIDATOR=true
      shift
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    --timeout|-t)
      TIMEOUT="$2"
      shift 2
      ;;
    --test)
      SPECIFIC_TEST="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--functional|-f] [--anchor|-a] [--unit|-u] [--integration|-i] [--e2e|-e] [--validator|-v] [--verbose] [--timeout|-t TIMEOUT] [--test SPECIFIC_TEST]"
      exit 1
      ;;
  esac
done

# Make sure the IDL exists by running build with skip-bpf if needed
if [ ! -f "target/idl/mica_eur.json" ]; then
  echo "IDL file not found. Running build script first..."
  ./scripts/build.sh --skip-bpf
fi

# If using Anchor's testing framework
if [ "$USE_ANCHOR" = true ]; then
  echo "Using Anchor's test framework..."
  
  if [ -n "$SPECIFIC_TEST" ]; then
    echo "Running specific Anchor test: $SPECIFIC_TEST"
    anchor test --skip-build --skip-deploy --filter "$SPECIFIC_TEST"
  else
    echo "Running all Anchor tests..."
    anchor test --skip-build
  fi
  
  exit $?
fi

# Start validator if needed and not using Anchor tests
if [ "$START_VALIDATOR" = true ]; then
  echo "Starting local validator..."
  
  # Check if a validator is already running
  if solana cluster-version &> /dev/null; then
    echo "Local validator is already running."
  else
    # Start validator in background
    echo "Starting Solana test validator..."
    solana-test-validator --quiet &
    VALIDATOR_PID=$!
    
    # Wait for validator to start
    echo "Waiting for validator to start..."
    sleep 5
    
    # Configure Solana CLI to use local validator
    solana config set --url localhost
  fi
fi

# Run the appropriate tests
echo "Running $TEST_TYPE tests..."

# If a specific test is provided, run just that test
if [ -n "$SPECIFIC_TEST" ]; then
  echo "Running specific test: $SPECIFIC_TEST"
  npx ts-mocha -p ./tsconfig.json -t $TIMEOUT "$SPECIFIC_TEST"
else
  case "$TEST_TYPE" in
    "functional")
      echo "Running functional tests..."
      npx ts-mocha -p ./tsconfig.json -t $TIMEOUT tests/mica-eur-functional-tests.ts
      ;;
    "unit")
      echo "Running unit tests..."
      npx ts-mocha -p ./tsconfig.json -t $TIMEOUT "tests/unit/**/*.ts"
      ;;
    "integration")
      echo "Running integration tests..."
      npx ts-mocha -p ./tsconfig.json -t $TIMEOUT "tests/integration/**/*.ts"
      ;;
    "e2e")
      echo "Running e2e tests..."
      npx ts-mocha -p ./tsconfig.json -t $TIMEOUT "tests/e2e/**/*.ts"
      ;;
    *)
      echo "Unknown test type: $TEST_TYPE"
      exit 1
      ;;
  esac
fi

TEST_RESULT=$?

# Kill validator if we started it and not using Anchor tests
if [ "$START_VALIDATOR" = true ] && [ -n "$VALIDATOR_PID" ]; then
  echo "Stopping local validator..."
  kill $VALIDATOR_PID
fi

if [ $TEST_RESULT -eq 0 ]; then
  echo "Tests completed successfully!"
else
  echo "Tests failed with exit code: $TEST_RESULT"
fi

exit $TEST_RESULT 