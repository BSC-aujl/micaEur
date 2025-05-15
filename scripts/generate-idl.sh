#!/bin/bash
# Generate IDL from built program
set -e

echo "=== Generating IDL from built program ==="

# Make sure target directories exist
mkdir -p target/idl

# Copy the program ID from keypair
PROGRAM_ID=$(solana-keygen pubkey target/deploy/mica_eur-keypair.json)
echo "Program ID: $PROGRAM_ID"

# Extract the IDL from the built program
if command -v anchor &> /dev/null; then
  echo "Extracting IDL using Anchor..."
  anchor idl init --filepath target/idl/mica_eur.json "$PROGRAM_ID" || true
else
  echo "Anchor CLI not found for IDL generation."
  exit 1
fi

# Verify the IDL was created
if [ -f "target/idl/mica_eur.json" ]; then
  echo "✅ Successfully generated IDL file"
else
  echo "❌ Failed to generate IDL file"
  exit 1
fi 