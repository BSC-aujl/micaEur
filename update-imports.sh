#!/bin/bash

# Update imports in e2e tests
find tests/e2e -name "*.ts" -exec sed -i 's|from "../framework/|from "../utils/|g' {} \;

# Update imports in integration tests
find tests/integration -name "*.ts" -exec sed -i 's|from "../framework/|from "../utils/|g' {} \;

# Update imports in unit tests
find tests/unit -name "*.ts" -exec sed -i 's|from "../framework/|from "../utils/|g' {} \;

echo "Import paths updated successfully!" 