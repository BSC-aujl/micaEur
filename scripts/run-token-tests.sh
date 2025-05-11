#!/bin/bash
# Script to run only the Token functionality tests using LiteSVM

set -e

echo "=== MiCA EUR Token Functionality Tests ==="

# Check if required packages are installed
for pkg in "litesvm" "@solana/web3.js" "@solana/spl-token" "chai" "@types/chai"; do
  if ! npm list $pkg &> /dev/null; then
    echo "$pkg not found. Installing..."
    npm install --save-dev $pkg
  fi
done

# Run the tests with grep to only run Token tests
echo "Running Token functionality tests..."
npx ts-mocha -p ./tsconfig.json -t 1000000 tests/mica-eur-functional-tests.ts -g "Token Functionality"

exit_code=$?

if [ $exit_code -ne 0 ]; then
  echo "Token tests failed with exit code: $exit_code"
else
  echo "Token tests completed successfully!"
fi

exit $exit_code 