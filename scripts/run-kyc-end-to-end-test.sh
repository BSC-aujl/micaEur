#!/bin/bash
# Script to run the end-to-end KYC flow test

set -e

echo "=== MiCA EUR KYC End-to-End Flow Test ==="

# Check if required packages are installed
for pkg in "litesvm" "@solana/web3.js" "@solana/spl-token" "chai" "@types/chai"; do
  if ! npm list $pkg &> /dev/null; then
    echo "$pkg not found. Installing..."
    npm install --save-dev $pkg
  fi
done

# Run the test
echo "Running KYC End-to-End Flow test..."
npx ts-mocha -p ./tsconfig.json -t 1000000 tests/kyc-end-to-end-flow.ts

exit_code=$?

if [ $exit_code -ne 0 ]; then
  echo "KYC End-to-End Flow test failed with exit code: $exit_code"
else
  echo "KYC End-to-End Flow test completed successfully!"
fi

exit $exit_code 