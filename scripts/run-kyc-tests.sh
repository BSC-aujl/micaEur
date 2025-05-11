#!/bin/bash
# Script to run only the KYC Oracle tests using LiteSVM

set -e

echo "=== MiCA EUR KYC Oracle Tests ==="

# Check if required packages are installed
for pkg in "litesvm" "@solana/web3.js" "@solana/spl-token" "chai" "@types/chai"; do
  if ! npm list $pkg &> /dev/null; then
    echo "$pkg not found. Installing..."
    npm install --save-dev $pkg
  fi
done

# Run the tests with grep to only run KYC tests
echo "Running KYC Oracle tests..."
npx ts-mocha -p ./tsconfig.json -t 1000000 tests/mica-eur-functional-tests.ts -g "KYC Oracle"

exit_code=$?

if [ $exit_code -ne 0 ]; then
  echo "KYC tests failed with exit code: $exit_code"
else
  echo "KYC tests completed successfully!"
fi

exit $exit_code 