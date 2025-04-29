#!/usr/bin/env node

/**
 * Initialize dotenv.org Vault Setup for MiCA EUR Project
 * 
 * This script sets up dotenv.org vault integration for secure
 * environment variable management across development, test, and 
 * production environments.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Check if .env file exists
const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.example');

// Create .env from example if it doesn't exist
if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
  console.log('Creating .env file from .env.example...');
  fs.copyFileSync(envExamplePath, envPath);
} else if (!fs.existsSync(envPath)) {
  console.log('Creating empty .env file...');
  fs.writeFileSync(envPath, '# Environment Variables for MiCA EUR\n', 'utf-8');
}

// Check if dotenv-vault is installed
console.log('Checking dotenv-vault installation...');
try {
  execSync('npx dotenv-vault --version', { stdio: 'ignore' });
  console.log('✅ dotenv-vault is available');
} catch (error) {
  console.error('❌ dotenv-vault CLI is not available');
  console.log('Installing dotenv-vault CLI...');
  try {
    execSync('npm install -g dotenv-vault', { stdio: 'inherit' });
    console.log('✅ dotenv-vault installed successfully');
  } catch (installError) {
    console.error('❌ Failed to install dotenv-vault CLI');
    console.error(installError.message);
    process.exit(1);
  }
}

// Initialize dotenv-vault if .env.vault doesn't exist
const envVaultPath = path.join(__dirname, '..', '.env.vault');
if (!fs.existsSync(envVaultPath)) {
  console.log('Initializing dotenv-vault for the project...');
  try {
    // Run in the project root directory
    execSync('npx dotenv-vault new', { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    console.log('✅ dotenv-vault initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize dotenv-vault');
    console.error(error.message);
    process.exit(1);
  }
} else {
  console.log('✅ dotenv-vault is already initialized');
}

// Push current .env to dotenv-vault development environment
console.log('Pushing current environment to dotenv-vault development environment...');
try {
  execSync('npx dotenv-vault push', { 
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
  console.log('✅ Successfully pushed to development environment');
} catch (error) {
  console.error('❌ Failed to push to dotenv-vault development environment');
  console.error(error.message);
}

// Create test environment if not exists
console.log('Setting up test environment in dotenv-vault...');
try {
  // Create a temporary .env.test file if it doesn't exist
  const envTestPath = path.join(__dirname, '..', '.env.test');
  if (!fs.existsSync(envTestPath)) {
    fs.writeFileSync(envTestPath, '# Test Environment\nTEST_MODE=true\n', 'utf-8');
  }

  // Push to test environment
  execSync('npx dotenv-vault push test', { 
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
  console.log('✅ Successfully set up test environment');
} catch (error) {
  console.error('❌ Failed to set up test environment');
  console.error(error.message);
}

// Generate dotenv-vault keys for CI/CD
console.log('Generating dotenv.org vault keys for CI/CD...');
try {
  execSync('npx dotenv-vault keys', { 
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
  console.log('✅ Successfully generated vault keys');
} catch (error) {
  console.error('❌ Failed to generate vault keys');
  console.error(error.message);
}

// Output next steps
console.log('\n🎉 dotenv.org vault setup complete!');
console.log('\nNext steps:');
console.log('1. Generate test keys and store them in the vault:');
console.log('   $ node scripts/generate-test-keys.js');
console.log('2. Pull environment variables from the vault:');
console.log('   $ npx dotenv-vault pull');
console.log('3. For CI/CD integration, add the DOTENV_KEY to your CI/CD environment');
console.log('\nManage your environments at: https://vault.dotenv.org'); 