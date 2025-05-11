#!/bin/bash
# Script to build without BPF compilation
set -e

echo "=== MiCA EUR No-BPF Build Script ==="

# Check for anchor CLI
if ! command -v anchor &> /dev/null; then
    echo "❌ Anchor CLI not found. Please install it first."
    exit 1
fi

# Create directories
mkdir -p target/idl
mkdir -p target/types

# Generate a minimal IDL file
echo "Generating minimal IDL file for development..."
cat > target/idl/mica_eur.json << EOF
{
  "version": "0.1.0",
  "name": "mica_eur",
  "instructions": [],
  "accounts": [],
  "types": [],
  "metadata": {
    "address": "9x3tkUkajECAgPvS59YTAdD7VZRMRckrPxFC4MZspup5"
  }
}
EOF

echo "✅ Successfully generated minimal IDL file for development"
echo "Run your tests with ./scripts/run-functional-tests.sh to use LiteSVM emulation"
echo "Note: Full BPF compilation is skipped due to missing target support" 