#!/bin/bash

# Test the pre-commit hooks
echo "Testing KYC verification levels script..."
node scripts/verify-kyc-levels.js
if [ $? -ne 0 ]; then
    echo "❌ KYC verification levels script test failed"
    exit 1
fi
echo "✅ KYC verification levels script passed"

echo "Testing pre-commit test script..."
./scripts/run-precommit-tests.sh
if [ $? -ne 0 ]; then
    echo "❌ Pre-commit test script failed"
    exit 1
fi
echo "✅ Pre-commit test script passed"

echo "All pre-commit tests passed successfully!"
exit 0 