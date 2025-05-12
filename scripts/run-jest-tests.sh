#!/bin/bash
# Script to run Jest tests for MiCA EUR

set -e

echo "=== MiCA EUR Jest Tests ==="

# Check if the IDL file exists
if [ ! -f "./target/idl/mica_eur.json" ]; then
  echo "❌ IDL file not found at ./target/idl/mica_eur.json"
  echo "Run 'anchor build' or './scripts/build.sh' to generate the IDL file"
  exit 1
fi

# Check if solana-test-validator is running
if ! pgrep -f "solana-test-validator" > /dev/null; then
  echo "⚠️ Local validator not detected. Starting solana-test-validator..."
  # Try to start with a clean ledger
  rm -rf test-ledger &>/dev/null || true
  solana-test-validator --quiet &
  VALIDATOR_PID=$!
  
  # Give it a moment to start
  echo "Waiting for validator to start..."
  sleep 5
else
  echo "✅ Local validator already running"
  VALIDATOR_PID=""
fi

# Check if the program is deployed
PROGRAM_ID="DCUKPkoLJs8rNQcJS7a37eHhyggTer2WMnb239qRyRKT"
if ! solana account $PROGRAM_ID &>/dev/null; then
  echo "⚠️ Program not found at $PROGRAM_ID"
  echo "You may need to deploy the program first using 'anchor deploy' or './scripts/deploy.sh'"
  echo "Continuing with tests, but some tests may fail..."
fi

# Parse command line arguments
TEST_TYPE="all"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --full)
      TEST_TYPE="full"
      shift
      ;;
    --basic)
      TEST_TYPE="basic"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--full|--basic]"
      exit 1
      ;;
  esac
done

# Run the tests
echo "Running $TEST_TYPE Jest tests..."

if [ "$TEST_TYPE" = "full" ]; then
  npm run test:jest:full
elif [ "$TEST_TYPE" = "basic" ]; then
  npm run test:jest -- --testMatch="**/tests/jest/mica-eur.test.ts"
else
  npm run test:jest
fi

EXIT_CODE=$?

# Kill the validator if we started it
if [ -n "$VALIDATOR_PID" ]; then
  echo "Stopping local validator..."
  kill $VALIDATOR_PID
fi

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ Tests completed successfully!"
else
  echo "❌ Tests failed with exit code: $EXIT_CODE"
fi

exit $EXIT_CODE 