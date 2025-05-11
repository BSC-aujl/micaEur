#!/bin/bash
# Script to run only the Freeze/Seize functionality tests using LiteSVM

set -e

echo "=== MiCA EUR Freeze/Seize Functionality Tests ==="

# Check if required packages are installed
for pkg in "litesvm" "@solana/web3.js" "@solana/spl-token" "chai" "@types/chai"; do
  if ! npm list $pkg &> /dev/null; then
    echo "$pkg not found. Installing..."
    npm install --save-dev $pkg
  fi
done

# Run the tests with grep to only run Freeze/Seize tests
echo "Running Freeze/Seize functionality tests..."
npx ts-mocha -p ./tsconfig.json -t 1000000 tests/mica-eur-functional-tests.ts -g "Freeze/Seize"

exit_code=$?

if [ $exit_code -ne 0 ]; then
  echo "Freeze/Seize tests failed with exit code: $exit_code"
else
  echo "Freeze/Seize tests completed successfully!"
fi

exit $exit_code 