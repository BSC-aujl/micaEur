#!/usr/bin/env node

/**
 * TypeScript Test Runner for the MiCA EUR project
 * This script handles the test setup, runs the tests, and reports results.
 * 
 * Features:
 * - Parallel test execution
 * - Test grouping
 * - Validator management
 * - Detailed reporting
 */

// Signature: ZHVtbXlfc2lnbmF0dXJlX2Zvcl9ydW5fdHNfdGVzdHNfc2NyaXB0

/* eslint-disable @typescript-eslint/no-var-requires, no-console */
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration
const CONFIG = {
  testTimeoutMs: 180000,
  smokeTestTimeoutMs: 60000,
  validatorStartupTimeMs: 5000,
  testDir: path.join(process.cwd(), 'tests', 'new-approach'),
  tsConfig: path.join(process.cwd(), 'tests', 'tsconfig.json'),
  logErrors: true,
  exitOnFail: process.env.CI === 'true' || process.env.FORCE_EXIT_ON_ERROR === '1', // Exit on fail in CI environment
  maxParallel: process.env.MAX_PARALLEL_TESTS || Math.max(1, os.cpus().length - 1) // Default to CPU count - 1
};

// Test groups
const TEST_GROUPS = {
  smoke: ['smoke.test.ts'],
  kyc: ['kyc-oracle.test.ts'],
  mint: ['token-mint.test.ts'],
  freeze: ['freeze-seize.test.ts'],
  extensions: ['token-extensions.test.ts'],
  comprehensive: ['comprehensive.test.ts'],
  all: null // Will be populated with all test files
};

// Color codes for console output
const COLOR = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Utility for printing colored log messages
function log(message, color = COLOR.reset, prefix = '') {
  console.log(`${color}${prefix}${message}${COLOR.reset}`);
}

// Run a single test file in a separate process
function runTestFile(filePath, timeout) {
  return new Promise((resolve) => {
    const command = `npx ts-mocha -p ${CONFIG.tsConfig} ${filePath} --timeout ${timeout}`;
    const testName = path.basename(filePath);
    
    log(`🔍 Starting: ${testName}`, COLOR.blue);
    
    const startTime = Date.now();
    const child = spawn('bash', ['-c', command], { stdio: 'pipe' });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      if (code === 0) {
        log(`✅ Passed: ${testName} (${duration}s)`, COLOR.green);
        resolve({ success: true, file: testName, duration, stdout, stderr });
      } else {
        log(`❌ Failed: ${testName} (${duration}s)`, COLOR.red);
        if (CONFIG.logErrors && stderr) {
          log(`Error output for ${testName}:`, COLOR.red);
          console.error(stderr);
        }
        resolve({ success: false, file: testName, duration, stdout, stderr });
      }
    });
  });
}

// Run tests in parallel with a limit on concurrent tests
async function runTestsInParallel(testFiles, timeout, maxParallel = CONFIG.maxParallel) {
  const filePaths = testFiles.map(file => path.join(CONFIG.testDir, file));
  const results = [];
  const queue = [...filePaths];
  const runningTests = [];
  
  const startNextTest = () => {
    if (queue.length === 0) return;
    
    const filePath = queue.shift();
    const testPromise = runTestFile(filePath, timeout)
      .then(result => {
        results.push(result);
        const index = runningTests.indexOf(testPromise);
        if (index !== -1) {
          runningTests.splice(index, 1);
        }
        startNextTest();
      });
    
    runningTests.push(testPromise);
  };
  
  // Start initial batch of tests
  const initialCount = Math.min(maxParallel, queue.length);
  for (let i = 0; i < initialCount; i++) {
    startNextTest();
  }
  
  // Wait for all tests to complete
  while (runningTests.length > 0) {
    await Promise.race(runningTests);
  }
  
  return results;
}

// Main execution function
async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const options = parseArguments(args);
    
    // Display help if requested
    if (options.help) {
      showHelp();
      return;
    }
    
    // Populate all tests if needed
    if (!TEST_GROUPS.all) {
      TEST_GROUPS.all = getTestFiles();
    }
    
    // Figure out which tests to run
    const testGroup = options.group || 'smoke';
    let testFiles;
    
    // Check if it's a predefined group
    if (TEST_GROUPS[testGroup]) {
      testFiles = TEST_GROUPS[testGroup];
    } else {
      // Try to find test files by name
      testFiles = findTestFile(testGroup);
      
      if (!testFiles) {
        log(`No test files found for: ${testGroup}`, COLOR.red);
        log('Available test groups:', COLOR.yellow);
        Object.keys(TEST_GROUPS).forEach(group => {
          if (group !== 'all') {
            log(`  ${group}`, COLOR.yellow);
          }
        });
        log('Or specify a test name that matches a .test.ts file', COLOR.yellow);
        process.exit(1);
      }
    }
    
    if (!testFiles || testFiles.length === 0) {
      log(`No test files found for group: ${testGroup}`, COLOR.red);
      process.exit(1);
    }
    
    // Start the validator if requested
    if (options.startValidator) {
      log('Starting local validator...', COLOR.cyan);
      try {
        execSync('npm run validator:up', { stdio: 'inherit' });
        log(`Waiting ${CONFIG.validatorStartupTimeMs/1000} seconds for validator to start...`, COLOR.yellow);
        await new Promise(resolve => setTimeout(resolve, CONFIG.validatorStartupTimeMs));
      } catch (error) {
        log('Failed to start validator. Tests may fail if validator is not running.', COLOR.red);
      }
    }
    
    // Display test plan
    const timeout = testGroup === 'smoke' ? CONFIG.smokeTestTimeoutMs : CONFIG.testTimeoutMs;
    const parallel = options.parallel !== undefined ? options.parallel : (testGroup !== 'comprehensive');
    const maxParallel = parallel ? (options.maxParallel || CONFIG.maxParallel) : 1;
    
    log('\n🧪 Running Tests', COLOR.bright + COLOR.cyan);
    log(`Group: ${testGroup}`, COLOR.cyan);
    log(`Files: ${testFiles.join(', ')}`, COLOR.cyan);
    log(`Timeout: ${timeout}ms`, COLOR.cyan);
    log(`Parallel: ${parallel ? `Yes (max ${maxParallel} at once)` : 'No'}`, COLOR.cyan);
    log('-'.repeat(80), COLOR.cyan);
    
    // Run the tests
    const results = parallel 
      ? await runTestsInParallel(testFiles, timeout, maxParallel)
      : await Promise.all(testFiles.map(file => {
        const filePath = path.join(CONFIG.testDir, file);
        return runTestFile(filePath, timeout);
      }));
    
    // Display summary
    log('\n----- Test Summary -----', COLOR.bright + COLOR.cyan);
    
    const passedTests = results.filter(r => r.success);
    const failedTests = results.filter(r => !r.success);
    
    log(`Total: ${results.length} tests`, COLOR.cyan);
    log(`Passed: ${passedTests.length} tests`, COLOR.green);
    log(`Failed: ${failedTests.length} tests`, failedTests.length > 0 ? COLOR.red : COLOR.cyan);
    
    const totalDuration = results.reduce((sum, r) => sum + parseFloat(r.duration), 0).toFixed(2);
    log(`Duration: ${totalDuration} seconds`, COLOR.cyan);
    
    if (failedTests.length > 0) {
      log('\nFailed Tests:', COLOR.red);
      failedTests.forEach(test => {
        log(`- ${test.file} (${test.duration}s)`, COLOR.red);
      });
      
      if (CONFIG.exitOnFail) {
        log('Exiting due to test failure', COLOR.red);
        process.exit(1);
      }
    } else {
      log('\n✅ All tests passed!', COLOR.bright + COLOR.green);
    }
    
  } catch (error) {
    log(`Error running tests: ${error.message}`, COLOR.red);
    if (CONFIG.logErrors) {
      log(error.stack, COLOR.red);
    }
    process.exit(1);
  }
}

// Parse command line arguments
function parseArguments(args) {
  const options = {
    group: null,
    startValidator: false,
    help: false,
    parallel: undefined,
    maxParallel: null
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--start-validator' || arg === '-v') {
      options.startValidator = true;
    } else if (arg === '--group' || arg === '-g') {
      options.group = args[++i];
    } else if (arg === '--parallel' || arg === '-p') {
      options.parallel = true;
    } else if (arg === '--no-parallel') {
      options.parallel = false;
    } else if (arg === '--max-parallel' || arg === '-m') {
      options.maxParallel = parseInt(args[++i], 10);
    } else if (!options.group) {
      // Assume it's a group name if not specified with --group
      options.group = arg;
    }
  }
  
  return options;
}

// Show help message
function showHelp() {
  log('\nMiCA EUR TypeScript Test Runner', COLOR.bright + COLOR.cyan);
  log('-'.repeat(80), COLOR.cyan);
  log('Usage: node run-ts-tests.js [options] [group|name]', COLOR.cyan);
  log('\nOptions:', COLOR.cyan);
  log('  --help, -h              Display this help message', COLOR.cyan);
  log('  --start-validator, -v   Start the local validator before running tests', COLOR.cyan);
  log('  --group, -g GROUP       Run tests from a specific group', COLOR.cyan);
  log('  --parallel, -p          Run tests in parallel (default for most groups)', COLOR.cyan);
  log('  --no-parallel           Run tests sequentially', COLOR.cyan);
  log('  --max-parallel, -m N    Maximum number of parallel tests (default: CPU count - 1)', COLOR.cyan);
  log('\nAvailable test groups:', COLOR.cyan);
  
  Object.keys(TEST_GROUPS).forEach(group => {
    if (group !== 'all') {
      const fileCount = TEST_GROUPS[group] ? TEST_GROUPS[group].length : 0;
      log(`  ${group.padEnd(15)} ${fileCount} test file(s)`, COLOR.cyan);
    }
  });
  
  log(`  all                 All test files`, COLOR.cyan);
  log('\nYou can also run tests by name:', COLOR.cyan);
  log('  node run-ts-tests.js token-feature    Run tests matching "token-feature.test.ts"', COLOR.cyan);
  
  log('\nExamples:', COLOR.cyan);
  log('  node run-ts-tests.js smoke           Run smoke tests only', COLOR.cyan);
  log('  node run-ts-tests.js -v all          Start validator and run all tests', COLOR.cyan);
  log('  node run-ts-tests.js -g mint -p      Run token mint tests in parallel', COLOR.cyan);
  log('  node run-ts-tests.js -m 4 all        Run all tests with max 4 parallel tests', COLOR.cyan);
  log('  node run-ts-tests.js my-new-feature  Run a newly created test file', COLOR.cyan);
}

// Get all test files from the test directory
function getTestFiles() {
  try {
    return fs.readdirSync(CONFIG.testDir)
      .filter(file => file.endsWith('.test.ts'));
  } catch (error) {
    log(`Error reading test directory: ${error.message}`, COLOR.red);
    return [];
  }
}

// Find a test file by name (without extension)
function findTestFile(name) {
  const files = getTestFiles();
  const normalizedName = name.toLowerCase().replace(/\s+/g, '-');
  
  // Try exact match first
  const exactMatch = files.find(file => file === `${normalizedName}.test.ts`);
  if (exactMatch) return [exactMatch];
  
  // Try to find something that contains the name
  const partialMatches = files.filter(file => 
    file.toLowerCase().includes(normalizedName) || 
    normalizedName.includes(file.replace('.test.ts', '').toLowerCase())
  );
  
  return partialMatches.length > 0 ? partialMatches : null;
}

// Run the script
main().catch(error => {
  log(`Uncaught error: ${error.message}`, COLOR.red);
  if (CONFIG.logErrors) {
    log(error.stack, COLOR.red);
  }
  process.exit(1);
}); 