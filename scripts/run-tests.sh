#!/bin/bash

# Run tests for MiCA EUR stablecoin
# Usage: ./scripts/run-tests.sh [--unit|--functional|--all]

set -e

# Source environment if available
if [ -f .env ]; then
    source .env
fi

# Parse command line arguments
TEST_TYPE="all"
if [ "$1" == "--unit" ]; then
    TEST_TYPE="unit"
elif [ "$1" == "--functional" ]; then
    TEST_TYPE="functional"
elif [ "$1" == "--all" ]; then
    TEST_TYPE="all"
fi

# Setup test environment
source scripts/setup-test-env.sh

# Run tests based on type
if [ "$TEST_TYPE" == "unit" ]; then
    echo "Running unit tests..."
    npx mocha -r ts-node/register 'tests/unit/**/*.ts' --timeout 60000
elif [ "$TEST_TYPE" == "functional" ]; then
    echo "Running functional tests..."
    npx mocha -r ts-node/register 'tests/functional/**/*.ts' --timeout 120000
else
    echo "Running all tests..."
    npx mocha -r ts-node/register 'tests/**/*.ts' --timeout 120000
fi

echo "Tests completed successfully!" 