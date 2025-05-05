#!/usr/bin/env node

/**
 * Test Validator Setup Script for MiCA EUR Project
 * 
 * This script sets up a local validator for testing, replacing
 * the shell-based script with a more reliable Node.js implementation.
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const sleep = promisify(setTimeout);

// Set to true to see more verbose output
const DEBUG = process.env.DEBUG === 'true';

// Parse command line arguments
const args = process.argv.slice(2);
const shouldBuild = args.includes('--build');
const noReset = args.includes('--no-reset');
const logFile = args.includes('--log-file') ? args[args.indexOf('--log-file') + 1] : null;

// Get project root directory
const projectRoot = path.resolve(__dirname, '..');

/**
 * Check if solana-test-validator is already running
 */
async function isValidatorRunning() {
  try {
    execSync('solana cluster-version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Start a local validator
 */
async function startValidator() {
  console.log('🚀 Starting local validator...');
  
  const resetFlag = noReset ? [] : ['--reset'];
  const args = [
    '--no-bpf-jit',
    ...resetFlag,
    '--quiet'
  ];
  
  // Add log file redirection if specified
  const stdio = logFile 
    ? ['ignore', fs.openSync(logFile, 'w'), fs.openSync(logFile, 'w')]
    : 'inherit';
  
  const validator = spawn('solana-test-validator', args, { 
    stdio,
    detached: true
  });
  
  // Handle validator process
  validator.on('error', (error) => {
    console.error(`Validator error: ${error.message}`);
  });
  
  // Wait for validator to start
  console.log('⏳ Waiting for validator to start...');
  let attempts = 0;
  const maxAttempts = 30;
  
  while (attempts < maxAttempts) {
    attempts++;
    try {
      execSync('solana cluster-version', { stdio: 'ignore' });
      console.log('✅ Local validator is running!');
      return validator;
    } catch (error) {
      if (DEBUG) {
        console.log(`Waiting for validator to start (attempt ${attempts}/${maxAttempts})...`);
      }
      await sleep(1000);
    }
  }
  
  console.error('❌ Failed to start validator after multiple attempts');
  process.exit(1);
}

/**
 * Build and deploy the program
 */
async function buildAndDeploy() {
  console.log('🔨 Building the program...');
  
  try {
    execSync('anchor build', { stdio: 'inherit', cwd: projectRoot });
  } catch (error) {
    console.error('❌ Failed to build program');
    console.error(error.message);
    process.exit(1);
  }
  
  console.log('📦 Deploying the program...');
  
  try {
    execSync('anchor deploy', { stdio: 'inherit', cwd: projectRoot });
  } catch (error) {
    console.error('❌ Failed to deploy program');
    console.error(error.message);
    process.exit(1);
  }
  
  console.log('✅ Program deployed successfully!');
}

/**
 * Set up environment variables for testing
 */
function setupEnvironment() {
  console.log('🌐 Setting up environment variables...');
  
  // Set Solana to use local network
  try {
    execSync('solana config set --url localhost', { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Failed to set Solana config');
    console.error(error.message);
    // Continue despite error
  }
  
  // Set program ID in .env file if available
  try {
    const programKeypairPath = path.join(projectRoot, 'target', 'deploy', 'mica_eur-keypair.json');
    
    if (fs.existsSync(programKeypairPath)) {
      const programId = execSync(`solana-keygen pubkey ${programKeypairPath}`)
        .toString()
        .trim();
      
      // Update .env file if it exists
      const envPath = path.join(projectRoot, '.env');
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');
        
        // Replace or add PROGRAM_ID
        if (envContent.includes('PROGRAM_ID=')) {
          envContent = envContent.replace(/PROGRAM_ID=.*\n/, `PROGRAM_ID=${programId}\n`);
        } else {
          envContent += `\nPROGRAM_ID=${programId}\n`;
        }
        
        fs.writeFileSync(envPath, envContent);
        console.log(`✅ Updated PROGRAM_ID in .env file: ${programId}`);
      }
    }
  } catch (error) {
    if (DEBUG) {
      console.error('Failed to update program ID in .env file:');
      console.error(error.message);
    }
    // Continue despite error
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🧪 Setting up test environment...');
  
  // Check if validator is already running
  const validatorRunning = await isValidatorRunning();
  
  // Start validator if not already running
  if (!validatorRunning) {
    const validator = await startValidator();
    
    // Ensure validator is killed when script exits
    process.on('exit', () => {
      if (validator && !validator.killed) {
        console.log('📴 Stopping validator...');
        process.kill(-validator.pid);
      }
    });
    
    // Also handle SIGINT
    process.on('SIGINT', () => {
      if (validator && !validator.killed) {
        console.log('📴 Stopping validator...');
        process.kill(-validator.pid);
      }
      process.exit(0);
    });
  } else {
    console.log('✅ Local validator is already running');
  }
  
  // Build and deploy if requested
  if (shouldBuild) {
    await buildAndDeploy();
  }
  
  // Set up environment variables
  setupEnvironment();
  
  console.log('✅ Test environment setup complete!');
}

// Run the main function
main().catch(error => {
  console.error('❌ Setup failed:');
  console.error(error);
  process.exit(1);
}); 