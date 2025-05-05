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

// Configuration
const TEST_DIR = path.join(process.cwd(), 'tests');
const NEW_APPROACH_DIR = path.join(TEST_DIR, 'new-approach');
const TS_TEST_PATTERN = /\.test\.ts$/;

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

// Get all TypeScript test files
function getTestFiles() {
  try {
    const allFiles = [];
    
    // Get files from new-approach directory
    if (fs.existsSync(NEW_APPROACH_DIR)) {
      const newApproachFiles = fs.readdirSync(NEW_APPROACH_DIR)
        .filter(file => TS_TEST_PATTERN.test(file))
        .map(file => path.join(NEW_APPROACH_DIR, file));
      
      allFiles.push(...newApproachFiles);
    }
    
    // Get any other test files from subdirectories
    const walkDir = (dir) => {
      if (!fs.existsSync(dir)) return;
      
      fs.readdirSync(dir, { withFileTypes: true }).forEach(dirent => {
        const res = path.join(dir, dirent.name);
        if (dirent.isDirectory() && dirent.name !== 'new-approach') {
          walkDir(res);
        } else if (dirent.isFile() && TS_TEST_PATTERN.test(dirent.name)) {
          allFiles.push(res);
        }
      });
    };
    
    walkDir(TEST_DIR);
    return allFiles;
  } catch (error) {
    log(`Error reading test files: ${error.message}`, COLOR.red);
    return [];
  }
}

// Validate test file
function validateTestFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];
  
  // Check for proper imports from test framework
  if (!content.includes('import') || 
      !content.includes('from \'../framework/') && 
      !content.includes('import { assert } from \'chai\'') && 
      !content.includes('import { expect } from \'chai\'')) {
    issues.push('Missing imports from test framework or chai');
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