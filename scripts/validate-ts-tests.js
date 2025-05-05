#!/usr/bin/env node

/**
 * TypeScript Test Validation Script
 * 
 * This script validates that TypeScript tests follow project standards:
 * - Proper naming conventions (*.test.ts)
 * - Proper imports from test framework
 * - Proper use of types in test files
 * - Proper describe/it structure
 */

// Signature: ZHVtbXlfc2lnbmF0dXJlX2Zvcl92YWxpZGF0ZV90c190ZXN0c19zY3JpcHQ=

/* eslint-disable @typescript-eslint/no-var-requires, no-console */
const fs = require('fs');
const path = require('path');

// Constants
const TEST_DIR = path.join(process.cwd(), 'tests');
const UNIT_TEST_DIR = path.join(TEST_DIR, 'unit');
const INTEGRATION_TEST_DIR = path.join(TEST_DIR, 'integration');
const E2E_TEST_DIR = path.join(TEST_DIR, 'e2e');
const UTILS_DIR = path.join(TEST_DIR, 'utils');

// Color codes for console output
const COLOR = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

// Log message with color
function log(message, color = COLOR.reset) {
  console.log(`${color}${message}${COLOR.reset}`);
}

// Function to get all test files
function getTestFiles() {
  const testFiles = [];

  // Get files from unit tests directory
  const unitFiles = fs.readdirSync(UNIT_TEST_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isFile() && dirent.name.endsWith('.test.ts'))
    .map(dirent => path.join(UNIT_TEST_DIR, dirent.name));
  testFiles.push(...unitFiles);

  // Get files from integration tests directory
  const integrationFiles = fs.readdirSync(INTEGRATION_TEST_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isFile() && dirent.name.endsWith('.test.ts'))
    .map(dirent => path.join(INTEGRATION_TEST_DIR, dirent.name));
  testFiles.push(...integrationFiles);

  // Get files from e2e tests directory
  const e2eFiles = fs.readdirSync(E2E_TEST_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isFile() && dirent.name.endsWith('.test.ts'))
    .map(dirent => path.join(E2E_TEST_DIR, dirent.name));
  testFiles.push(...e2eFiles);

  // Get files from other test directories (excluding unit, integration, e2e and utils)
  const dirs = fs.readdirSync(TEST_DIR, { withFileTypes: true });
  for (const dirent of dirs) {
    if (dirent.isDirectory() && !['unit', 'integration', 'e2e', 'utils', 'fixtures', 'templates'].includes(dirent.name)) {
      const dirPath = path.join(TEST_DIR, dirent.name);
      const walkDir = (dir) => {
        fs.readdirSync(dir, { withFileTypes: true }).forEach(subDirent => {
          const res = path.join(dir, subDirent.name);
          if (subDirent.isDirectory()) {
            walkDir(res);
          } else if (subDirent.isFile() && subDirent.name.endsWith('.test.ts')) {
            testFiles.push(res);
          }
        });
      };
      walkDir(dirPath);
    }
  }

  return testFiles;
}

// Validate test file
function validateTestFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];
  
  // Check for proper imports from test framework
  if (!content.includes('import') || 
      !content.includes('from \'../utils/') && 
      !content.includes('import { assert } from \'chai\'') && 
      !content.includes('import { expect } from \'chai\'')) {
    issues.push('Missing imports from test utilities or chai');
  }
  
  // Check for proper describe/it structure
  if (!content.includes('describe(') || !content.includes('it(')) {
    issues.push('Missing proper describe/it test structure');
  }
  
  // Check for TypeScript typing
  if (content.includes(': any') || content.includes('as any')) {
    issues.push('Uses "any" type which should be avoided');
  }
  
  // Check if there are untyped variables or functions
  const functionParams = content.match(/function\s+\w+\s*\(([^)]*)\)/g);
  if (functionParams) {
    for (const func of functionParams) {
      if (!func.includes(':') && !func.includes('()')) {
        issues.push('Found untyped function parameters');
        break;
      }
    }
  }
  
  // Check if using proper async/await
  if (content.includes('.then(') && !content.includes('async') && !content.includes('await')) {
    issues.push('Using .then() without async/await');
  }
  
  return { 
    valid: issues.length === 0,
    issues
  };
}

// Main function
function main() {
  log('🔍 Validating TypeScript tests...', COLOR.bright + COLOR.blue);
  
  const testFiles = getTestFiles();
  if (testFiles.length === 0) {
    log('No TypeScript test files found!', COLOR.yellow);
    return true;
  }
  
  log(`Found ${testFiles.length} TypeScript test files`, COLOR.blue);
  
  let allValid = true;
  
  for (const file of testFiles) {
    const result = validateTestFile(file);
    const relativePath = path.relative(process.cwd(), file);
    
    if (result.valid) {
      log(`✅ ${relativePath}`, COLOR.green);
    } else {
      log(`❌ ${relativePath}:`, COLOR.red);
      result.issues.forEach(issue => log(`   - ${issue}`, COLOR.red));
      allValid = false;
    }
  }
  
  if (allValid) {
    log('\n✅ All TypeScript tests validated successfully', COLOR.bright + COLOR.green);
  } else {
    log('\n❌ TypeScript test validation failed', COLOR.bright + COLOR.red);
    log('Please fix the issues in your test files and try again.', COLOR.yellow);
  }
  
  return allValid;
}

// Execute the script
const success = main();
process.exit(success ? 0 : 1); 