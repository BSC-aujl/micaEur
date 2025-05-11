#!/bin/bash
# Script to run functional tests using LiteSVM for testing KYC, AML, and Token functionality

set -e

echo "=== MiCA EUR Functional Tests ==="

# Check if required packages are installed
for pkg in "litesvm" "@solana/web3.js" "@solana/spl-token" "jest" "@types/jest"; do
  if ! npm list $pkg &> /dev/null; then
    echo "$pkg not found. Installing..."
    npm install --save-dev $pkg
  fi
done

# Run the tests
echo "Running MiCA EUR functional tests..."
npx ts-mocha -p ./tsconfig.json -t 1000000 tests/mica-eur-functional-tests.ts

exit_code=$?

if [ $exit_code -ne 0 ]; then
  echo "Functional tests failed with exit code: $exit_code"
else
  echo "Functional tests completed successfully!"
fi

exit $exit_code 