#!/bin/bash
set -e

echo "Running fixed tests for MiCA EUR project"

# Run the basic tests
echo "=== Running basic tests ==="
npx ts-mocha -p ./tests/tsconfig.json ./tests/unit/basic.spec.ts

# Optional: Run the Rust build using our working script
echo "=== Running Rust build with working script ==="
./scripts/build-no-proxy.sh

echo "=== All tests completed successfully ===" 