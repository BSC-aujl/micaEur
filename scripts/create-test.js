#!/usr/bin/env node

/**
 * Test Creation Script
 * 
 * This script creates a new test file from the template.
 * Usage: node create-test.js <test-name>
 * Example: node create-test.js token-transfer
 */

// Signature: ZHVtbXlfc2lnbmF0dXJlX2Zvcl9jcmVhdGVfdGVzdF9zY3JpcHQ=

/* eslint-disable @typescript-eslint/no-var-requires, no-console */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const TEMPLATE_DIR = path.join(process.cwd(), 'tests', 'templates');
const TEST_DIRS = {
  unit: path.join(process.cwd(), 'tests', 'unit'),
  integration: path.join(process.cwd(), 'tests', 'integration'),
  e2e: path.join(process.cwd(), 'tests', 'e2e')
};

const DEFAULT_TEMPLATE = 'test-template.ts';

// Color codes for console output
const COLOR = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Log message with color
function log(message, color = COLOR.reset) {
  console.log(`${color}${message}${COLOR.reset}`);
}

// Ensure all necessary directories exist
function ensureDirectories() {
  Object.values(TEST_DIRS).forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      log(`Created directory: ${dir}`, COLOR.green);
    }
  });
}

// Prompt the user for the test name
function promptForTestName() {
  return new Promise((resolve) => {
    rl.question(`${COLOR.cyan}Enter test name (without extension): ${COLOR.reset}`, (answer) => {
      resolve(answer.trim());
    });
  });
}

// Prompt the user for the test type (unit, integration, or e2e)
function promptForTestType() {
  return new Promise((resolve) => {
    rl.question(`${COLOR.cyan}Select test type:
  1. Unit Test (smaller, focused tests)
  2. Integration Test (multiple components)
  3. End-to-End Test (comprehensive flows)
Choose [1-3]: ${COLOR.reset}`, (answer) => {
      const choice = parseInt(answer.trim(), 10);
      switch (choice) {
        case 1: resolve('unit'); break;
        case 2: resolve('integration'); break;
        case 3: resolve('e2e'); break;
        default: 
          log('Invalid choice. Defaulting to unit test.', COLOR.yellow);
          resolve('unit');
      }
    });
  });
}

// Create a new test file from the template
function createTestFile(testName, testType) {
  const templatePath = path.join(TEMPLATE_DIR, DEFAULT_TEMPLATE);
  const fileName = `${testName}.test.ts`;
  const targetPath = path.join(TEST_DIRS[testType], fileName);
  
  if (fs.existsSync(targetPath)) {
    log(`File already exists: ${targetPath}`, COLOR.red);
    return false;
  }
  
  try {
    if (!fs.existsSync(templatePath)) {
      log(`Template not found: ${templatePath}`, COLOR.red);
      return false;
    }
    
    let templateContent = fs.readFileSync(templatePath, 'utf8');
    
    // Replace placeholders in the template
    templateContent = templateContent
      .replace(/TEST_TITLE/g, testName.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)).join(' '))
      .replace(/TEST_NAME/g, testName)
      .replace(/TEST_TYPE/g, testType)
      .replace(/CREATED_DATE/g, new Date().toISOString().split('T')[0]);
    
    fs.writeFileSync(targetPath, templateContent);
    log(`Created test file: ${targetPath}`, COLOR.green);
    return true;
  } catch (error) {
    log(`Error creating test file: ${error.message}`, COLOR.red);
    return false;
  }
}

// Main function
async function main() {
  try {
    log('\nMiCA EUR Test Creator', COLOR.bright + COLOR.cyan);
    log('----------------------', COLOR.cyan);
    
    ensureDirectories();
    
    const testName = await promptForTestName();
    if (!testName) {
      log('Test name is required.', COLOR.red);
      return;
    }
    
    const testType = await promptForTestType();
    const normalizedName = testName.toLowerCase().replace(/\s+/g, '-');
    
    const success = createTestFile(normalizedName, testType);
    
    if (success) {
      log('\nNext steps:', COLOR.yellow);
      log(`1. Edit your test file: ${normalizedName}.test.ts`, COLOR.yellow);
      log(`2. Run it with: npm run test:${testType} -- -g ${normalizedName}`, COLOR.yellow);
    }
    
  } catch (error) {
    log(`Error: ${error.message}`, COLOR.red);
  } finally {
    rl.close();
  }
}

// Run the main function
main(); 