#!/bin/bash

# Script to clean up unused files and directories in the MiCA EUR repository

echo "Starting cleanup of unused files and directories..."

# Cleanup unused script files in root directory
echo "Removing unused script files from root directory..."
rm -f update-imports.sh
rm -f cleanup-duplicate-tests.sh
rm -f cleanup-tests.sh
rm -f finish-migration.sh
rm -f run-js-test.js
rm -f run-simple-test.js
rm -f run-test.js

# Remove empty directories
echo "Removing empty/unused directories..."
if [ -d "test_anchor" ]; then
  if [ -z "$(ls -A test_anchor)" ]; then
    echo "Removing empty test_anchor directory..."
    rm -rf test_anchor
  else
    echo "test_anchor is not empty, skipping..."
  fi
fi

# Archive old environment files instead of deleting them
echo "Archiving old environment files..."
mkdir -p .env-archive
if [ -f ".env.previous" ]; then
  mv .env.previous .env-archive/
fi

# Check for unused test directories
if [ -d "tests/framework" ]; then
  if [ -z "$(ls -A tests/framework)" ]; then
    echo "Removing empty tests/framework directory..."
    rm -rf tests/framework
  else
    echo "tests/framework is not empty, skipping..."
  fi
fi

if [ -d "tests/new-approach" ]; then
  if [ -z "$(ls -A tests/new-approach)" ]; then
    echo "Removing empty tests/new-approach directory..."
    rm -rf tests/new-approach
  else
    echo "tests/new-approach is not empty, skipping..."
  fi
fi

echo "Cleanup completed!" 