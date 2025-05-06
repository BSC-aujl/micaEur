#!/bin/bash

# Final cleanup script for test files
# This script:
# 1. Moves any test files from the root tests directory to appropriate subdirectories
# 2. Updates imports in all test files to point to utils instead of framework
# 3. Removes the framework directory since it's been duplicated in utils

echo "Starting final cleanup of test files..."

# Move tests from root to appropriate directories
if [ -f "tests/kyc_oracle.test.ts" ]; then
  echo "Moving tests/kyc_oracle.test.ts to tests/unit/"
  mv tests/kyc_oracle.test.ts tests/unit/
fi

if [ -f "tests/token_extensions.test.ts" ]; then
  echo "Moving tests/token_extensions.test.ts to tests/unit/"
  mv tests/token_extensions.test.ts tests/unit/
fi

if [ -f "tests/token_mint.test.ts" ]; then
  echo "Moving tests/token_mint.test.ts to tests/unit/"
  mv tests/token_mint.test.ts tests/unit/
fi

# Update imports in all test files to point to utils instead of framework
echo "Updating imports to point to utils instead of framework..."
find tests -name "*.ts" -exec sed -i 's|from "../framework/|from "../utils/|g' {} \;
find tests -name "*.ts" -exec sed -i 's|from "../../framework/|from "../../utils/|g' {} \;
find tests -name "*.ts" -exec sed -i 's|from "./framework/|from "./utils/|g' {} \;

# Check if there are still imports pointing to framework
framework_imports=$(grep -r "from.*framework" tests --include="*.ts" | wc -l)
if [ "$framework_imports" -gt 0 ]; then
  echo "Warning: There are still $framework_imports imports pointing to framework directory"
  grep -r "from.*framework" tests --include="*.ts"
else
  echo "All imports updated successfully"
  
  # Remove the framework directory
  echo "Removing the framework directory..."
  rm -rf tests/framework
fi

echo "Final cleanup completed!" 