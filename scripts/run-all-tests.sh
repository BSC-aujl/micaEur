#!/bin/bash

# Exit on any error
set -e

echo "Starting test suite..."

# Build with our fixed build script
echo "Building Anchor program..."
cd ..
./scripts/build-no-proxy.sh

# Run our basic tests first
echo "Running basic unit tests..."
npx ts-mocha -p ./tests/tsconfig.json ./tests/unit/basic.spec.ts

# Run other unit tests
echo "Running unit tests..."
npx ts-mocha -p ./tests/tsconfig.json ./tests/unit/kyc_oracle.spec.ts
npx ts-mocha -p ./tests/tsconfig.json ./tests/unit/token_mint.spec.ts

echo "All tests passed successfully!" 