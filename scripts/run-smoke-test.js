#!/usr/bin/env node

/**
 * Run Smoke Test for Pre-commit Hooks
 * 
 * This script runs only the smoke tests that don't require a validator
 * and can be executed during pre-commit hooks.
 */

// Signature: ZHVtbXlfc2lnbmF0dXJlX2Zvcl9ydW5fc21va2VfdGVzdF9zY3JpcHQ=

/* eslint-disable @typescript-eslint/no-var-requires, no-console */
const { execSync } = require('child_process');
const path = require('path');

// Configure colors for console output
const COLOR = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m',
};

// Function to log with colors
function log(message, color = COLOR.reset) {
  console.log(`${color}${message}${COLOR.reset}`);
}

// Main function
function main() {
  try {
    log('🧪 Running smoke tests for pre-commit checks...', COLOR.cyan);
    
    // Set CI mode to avoid trying to connect to a validator
    process.env.CI = 'true';
    
    // Run only the smoke test
    log('📦 Running smoke test...', COLOR.yellow);
    
    const tsConfig = path.join(process.cwd(), 'tests', 'tsconfig.json');
    const smokeTestPath = path.join(process.cwd(), 'tests', 'unit', 'smoke.test.ts');
    
    execSync(`npx ts-mocha -p ${tsConfig} ${smokeTestPath} --timeout 10000`, {
      stdio: 'inherit',
    });
    
    log('✅ Smoke tests completed successfully!', COLOR.green);
    return 0;
  } catch (error) {
    log(`❌ Smoke tests failed: ${error.message}`, COLOR.red);
    return 1;
  }
}

// Run the main function and exit with the appropriate code
process.exit(main()); 