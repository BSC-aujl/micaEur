#!/bin/bash

# This script finishes the migration of test files to the new structure

# 1. Move remaining framework files to utils if they don't already exist
mkdir -p tests/utils
for file in tests/framework/*.ts; do
  filename=$(basename "$file")
  if [ ! -f "tests/utils/$filename" ]; then
    echo "Moving $file to tests/utils/$filename"
    cp "$file" "tests/utils/$filename"
  else
    echo "File tests/utils/$filename already exists, skipping"
  fi
done

# 2. Move remaining test files from new-approach
# Get a list of new-approach test files that aren't already migrated
for file in tests/new-approach/*.test.ts; do
  filename=$(basename "$file")
  base_name=${filename%.test.ts}
  
  # Determine target directory based on filename patterns
  target_dir="tests/unit"
  if [[ "$filename" == *"comprehensive"* ]] || [[ "$filename" == *"compliance-flow"* ]]; then
    target_dir="tests/e2e"
  elif [[ "$filename" == *"integration"* ]] || [[ "$filename" == *"freeze-seize"* ]] || [[ "$filename" == *"kyc-aml"* ]]; then
    target_dir="tests/integration"
  fi
  
  # Skip files we've already migrated by checking target location
  if [ -f "$target_dir/$filename" ]; then
    echo "Target file $target_dir/$filename already exists, creating stub"
    # Create a stub file that points to the new location
    cat > "$file" << EOF
/**
 * This file is deprecated and has been moved to $target_dir/$filename
 * 
 * Please use the new file location instead of this one.
 */

throw new Error("This test file has been moved to $target_dir/$filename");
EOF
  else
    # Copy the file to new location
    echo "Moving $file to $target_dir/$filename"
    cp "$file" "$target_dir/$filename"
    
    # Update imports in the new file
    sed -i 's|from "../framework/|from "../utils/|g' "$target_dir/$filename"
    
    # Create a stub file that points to the new location
    cat > "$file" << EOF
/**
 * This file is deprecated and has been moved to $target_dir/$filename
 * 
 * Please use the new file location instead of this one.
 */

throw new Error("This test file has been moved to $target_dir/$filename");
EOF
  fi
done

echo "Migration complete!" 