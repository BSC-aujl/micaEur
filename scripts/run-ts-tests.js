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
const path = require('path');
const os = require('os');

// Console color codes
const COLOR = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

// Configuration
const TEST_CONFIG = {
  // Global settings
  logErrors: true,
  exitOnFail: process.env.CI === 'true' || process.env.FORCE_EXIT_ON_ERROR === '1',
  maxParallel: process.env.MAX_PARALLEL_TESTS || Math.max(1, os.cpus().length - 1),
  validatorStartupTimeMs: 5000,
  tsConfig: path.join(process.cwd(), 'tests', 'tsconfig.json'),
  
  // Test groups
  all: {
    pattern: 'tests/{unit,integration,e2e}/**/*.test.ts',
    timeout: 120000,
    parallel: true,
  },
  unit: {
    pattern: 'tests/unit/**/*.test.ts',
    timeout: 60000,
    parallel: true,
  },
  integration: {
    pattern: 'tests/integration/**/*.test.ts',
    timeout: 90000,
    parallel: true,
  },
  e2e: {
    pattern: 'tests/e2e/**/*.test.ts',
    timeout: 120000,
    parallel: false,
  },
  smoke: {
    pattern: 'tests/unit/smoke.test.ts',
    timeout: 60000,
    parallel: false,
  },
  kyc: {
    pattern: 'tests/unit/kyc-oracle.test.ts',
    timeout: 60000,
    parallel: false,
  },
  mint: {
    pattern: 'tests/unit/token-mint.test.ts',
    timeout: 60000,
    parallel: false,
  },
  freeze: {
    pattern: 'tests/integration/freeze-seize.test.ts',
    timeout: 60000,
    parallel: false,
  },
  extensions: {
    pattern: 'tests/unit/token-extensions.test.ts',
    timeout: 60000,
    parallel: false,
  },
  comprehensive: {
    pattern: 'tests/e2e/comprehensive.test.ts',
    timeout: 180000,
    parallel: false,
  },
};

// Helper to log with color
function log(message, color = '') {
  console.log(`${color}${message}${COLOR.reset}`);
}

// Run a single test file
function runTestFile(filePath, timeout) {
  return new Promise((resolve) => {
    const command = `npx ts-mocha -r tests/utils/env-setup.ts -p ${TEST_CONFIG.tsConfig} ${filePath} --timeout ${timeout}`;
    const testName = path.basename(filePath);
    
    log(`▶️ Running: ${testName}`, COLOR.cyan);
    const startTime = Date.now();
    
    const child = spawn(command, { shell: true });
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      process.stdout.write(data);
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });
    
    child.on('close', (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      if (code === 0) {
        log(`✅ Passed: ${testName} (${duration}s)`, COLOR.green);
        resolve({ success: true, testName, duration });
      } else {
        log(`❌ Failed: ${testName} (${duration}s)`, COLOR.red);
        if (TEST_CONFIG.logErrors && stderr) {
          log(`Error output for ${testName}:`, COLOR.red);
          console.error(stderr);
        }
        resolve({ success: false, testName, duration });
      }
    });
  });
}

// Run tests in parallel with a limit on concurrent tests
async function runTestsInParallel(testFiles, timeout, maxParallel = TEST_CONFIG.maxParallel) {
  const results = [];
  const queue = [...testFiles];
  const running = new Set();
  
  while (queue.length > 0 || running.size > 0) {
    // Start new tests if under the parallel limit
    while (queue.length > 0 && running.size < maxParallel) {
      const filePath = queue.shift();
      const promise = runTestFile(filePath, timeout);
      running.add(promise);
      
      // When a test completes, remove it from running set
      promise.then(result => {
        results.push(result);
        running.delete(promise);
      });
    }
    
    // Wait for at least one test to finish before checking again
    if (running.size >= maxParallel || (running.size > 0 && queue.length === 0)) {
      await Promise.race(Array.from(running));
    }
  }
  
  return results;
}

// Find test files based on a pattern
function findTestFiles(pattern) {
  const { globSync } = require('glob');
  return globSync(pattern, { cwd: process.cwd() });
}

// Main function to run the tests
async function main() {
  try {
    // Parse command-line arguments
    const args = process.argv.slice(2);
    const testGroup = args[0] || 'all';
    const options = {
      verbose: args.includes('-v') || args.includes('--verbose'),
      parallel: !args.includes('--no-parallel'),
      startValidator: args.includes('--start-validator'),
      maxParallel: parseInt(args.find(arg => arg.startsWith('--max-parallel='))?.split('=')[1] || '0', 10) || undefined,
    };
    
    // Validate the test group
    if (!TEST_CONFIG[testGroup]) {
      log(`Unknown test group: ${testGroup}`, COLOR.red);
      log(`Available test groups: ${Object.keys(TEST_CONFIG).join(', ')}`, COLOR.yellow);
      return;
    }
    
    // Start the validator if requested
    if (options.startValidator) {
      log('Starting local validator...', COLOR.yellow);
      try {
        execSync('npm run validator:up', { stdio: 'inherit' });
        log(`Waiting ${TEST_CONFIG.validatorStartupTimeMs/1000} seconds for validator to start...`, COLOR.yellow);
        await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.validatorStartupTimeMs));
      } catch (error) {
        log('Failed to start validator. Tests may fail if validator is not running.', COLOR.red);
      }
    }
    
    // Get the test configuration
    const config = TEST_CONFIG[testGroup];
    
    // Find test files
    const testFiles = findTestFiles(config.pattern);
    if (testFiles.length === 0) {
      log(`No test files found matching pattern: ${config.pattern}`, COLOR.yellow);
      return;
    }
    
    // Display test plan
    const timeout = config.timeout;
    const parallel = options.parallel !== undefined ? options.parallel : config.parallel;
    const maxParallel = parallel ? (options.maxParallel || TEST_CONFIG.maxParallel) : 1;
    
    log('\n🧪 Running Tests', COLOR.bright + COLOR.cyan);
    log(`Test Group: ${testGroup}`, COLOR.cyan);
    log(`Total Files: ${testFiles.length}`, COLOR.cyan);
    log(`Timeout: ${timeout}ms`, COLOR.cyan);
    log(`Parallel: ${parallel ? `Yes (max ${maxParallel})` : 'No'}`, COLOR.cyan);
    
    // Run the tests
    const startTime = Date.now();
    const results = parallel && testFiles.length > 1
      ? await runTestsInParallel(testFiles, timeout, maxParallel)
      : await Promise.all(testFiles.map(file => runTestFile(file, timeout)));
    
    // Calculate and display results
    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    log('\n📊 Test Results', COLOR.bright + COLOR.cyan);
    log(`Total: ${results.length} tests`, COLOR.cyan);
    log(`Passed: ${passed} tests`, passed === results.length ? COLOR.green : COLOR.yellow);
    
    if (failed > 0) {
      log(`Failed: ${failed} tests`, COLOR.red);
      results.filter(r => !r.success).forEach(result => {
        log(`  - ${result.testName} (${result.duration}s)`, COLOR.red);
      });
      
      if (TEST_CONFIG.exitOnFail) {
        log('Exiting due to test failure', COLOR.red);
        process.exit(1);
      }
    }
    
    log(`Duration: ${totalDuration}s`, COLOR.cyan);
    log('\n✨ Done', COLOR.bright + COLOR.green);
    
  } catch (error) {
    log(`Error running tests: ${error.message}`, COLOR.red);
    if (TEST_CONFIG.logErrors) {
      log(error.stack, COLOR.red);
    }
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  log(`Uncaught error: ${error.message}`, COLOR.red);
  if (TEST_CONFIG.logErrors) {
    log(error.stack, COLOR.red);
  }
  process.exit(1);
});

// ensure AnchorProvider.env() works when no env vars are set
process.env.ANCHOR_PROVIDER_URL = process.env.ANCHOR_PROVIDER_URL || 'http://localhost:8899';
process.env.ANCHOR_WALLET = process.env.ANCHOR_WALLET || path.join(os.homedir(), '.config', 'solana', 'id.json'); 