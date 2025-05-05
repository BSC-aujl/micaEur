#!/bin/bash

# Script to clean up duplicate test files
# This script will rename legacy spec files to .spec.ts.bak to avoid confusion with the new test files

# Check if we are in the root of the project
if [ ! -d "tests" ]; then
  echo "Error: This script must be run from the root of the project"
  exit 1
fi

echo "Starting cleanup of duplicate test files..."

# Function to clean up spec files in a directory
cleanup_dir() {
  local dir=$1
  
  # Find all spec files in the directory
  for spec_file in ${dir}/*.spec.ts; do
    if [ -f "${spec_file}" ]; then
      # Get the base name
      base_name=$(basename "${spec_file}" .spec.ts)
      
      # Check if there's a .test.ts file with the same base name
      if [ -f "${dir}/${base_name}.test.ts" ]; then
        echo "Found duplicate: ${spec_file} and ${dir}/${base_name}.test.ts"
        echo "Backing up ${spec_file} to ${spec_file}.bak"
        mv "${spec_file}" "${spec_file}.bak"
      else
        echo "No duplicate found for ${spec_file}, keeping it as is"
      fi
    fi
  done
  
  # Also look for duplicate camelCase and snake_case test files
  for test_file in ${dir}/*.test.ts; do
    if [ -f "${test_file}" ]; then
      # Get the base name
      base_name=$(basename "${test_file}" .test.ts)
      
      # Convert snake_case to camelCase for comparison
      snake_case_name="${base_name//-/_}"
      
      if [ "${snake_case_name}" != "${base_name}" ] && [ -f "${dir}/${snake_case_name}.test.ts" ]; then
        echo "Found duplicate: ${test_file} and ${dir}/${snake_case_name}.test.ts"
        echo "Backing up ${dir}/${snake_case_name}.test.ts to ${dir}/${snake_case_name}.test.ts.bak"
        mv "${dir}/${snake_case_name}.test.ts" "${dir}/${snake_case_name}.test.ts.bak"
      fi
    fi
  done
}

# Clean up unit tests
echo "Cleaning up unit tests..."
cleanup_dir "tests/unit"

# Clean up integration tests
echo "Cleaning up integration tests..."
cleanup_dir "tests/integration"

# Clean up e2e tests
echo "Cleaning up e2e tests..."
cleanup_dir "tests/e2e"

echo "Cleanup completed!" 