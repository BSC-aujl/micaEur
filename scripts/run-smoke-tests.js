#!/usr/bin/env node

/**
 * Smoke Test Runner for MiCA EUR Project
 * 
 * This script runs a quick smoke test to verify the essential functionality
 * of the application. It's designed to be fast enough to run during pre-commit
 * but comprehensive enough to catch critical issues.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const SMOKE_TEST_TIMEOUT = 60000; // 60 seconds
const SMOKE_TEST_FILES = [
  'tests/unit/smoke.spec.ts',     // Basic smoke test
  'tests/unit/kyc_oracle.spec.ts' // KYC Oracle tests (essential)
];

// Test if the file exists
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (err) {
    return false;
  }
}

// Run a single test file
function runTestFile(testFile) {
  console.log(`🔄 Running smoke test: ${testFile}`);
  
  try {
    // Check if file exists
    const fullPath = path.resolve(process.cwd(), testFile);
    if (!fileExists(fullPath)) {
      console.error(`❌ Test file not found: ${testFile}`);
      return false;
    }
    
    // Run the test with a timeout
    const command = `npx ts-mocha -p ./tests/tsconfig.json --timeout ${SMOKE_TEST_TIMEOUT} ${testFile}`;
    execSync(command, { stdio: 'inherit' });
    
    console.log(`✅ Smoke test passed: ${testFile}`);
    return true;
  } catch (error) {
    console.error(`❌ Smoke test failed: ${testFile}`);
    if (error.stdout) console.error(error.stdout.toString());
    if (error.stderr) console.error(error.stderr.toString());
    return false;
  }
}

// Main function
function main() {
  console.log('🔥 Running smoke tests...');
  
  let allPassed = true;
  let testsRun = 0;
  
  for (const testFile of SMOKE_TEST_FILES) {
    if (fileExists(testFile)) {
      testsRun++;
      const passed = runTestFile(testFile);
      allPassed = allPassed && passed;
    } else {
      console.warn(`⚠️ Skipping missing test file: ${testFile}`);
    }
  }
  
  if (testsRun === 0) {
    console.warn('⚠️ No smoke tests were found or run');
    return false;
  }
  
  if (allPassed) {
    console.log('✅ All smoke tests passed!');
    return true;
  } else {
    console.error('❌ Some smoke tests failed');
    return false;
  }
}

// Execute and exit with appropriate code
const success = main();
process.exit(success ? 0 : 1); 