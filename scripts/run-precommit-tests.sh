#!/bin/bash
# Script to run essential tests for pre-commit validation

set -e

echo "=== MiCA EUR Pre-commit Tests ==="

# Check if required packages are installed
for pkg in "litesvm" "@solana/web3.js" "@solana/spl-token" "chai" "@types/chai"; do
  if ! npm list $pkg &> /dev/null; then
    echo "$pkg not found. Installing..."
    npm install --save-dev $pkg
  fi
done

# Run KYC verification level tests first (most critical)
echo "Running KYC verification level tests..."
npx ts-mocha -p ./tsconfig.json -t 60000 tests/kyc-end-to-end-flow.ts -g "verification levels" --reporter min

# Exit early if KYC tests fail
if [ $? -ne 0 ]; then
  echo "❌ KYC verification level tests failed! Please fix before committing."
  exit 1
fi

# Run a smaller subset of functional tests for speed
echo "Running critical functional tests..."
npx ts-mocha -p ./tsconfig.json -t 60000 tests/mica-eur-functional-tests.ts -g "KYC Oracle" --reporter min

exit_code=$?

if [ $exit_code -ne 0 ]; then
  echo "❌ Critical functional tests failed with exit code: $exit_code"
  exit $exit_code
else
  echo "✅ Pre-commit tests completed successfully!"
fi

exit 0 