#!/usr/bin/env node

/**
 * Test Key Generation Script for MiCA EUR Project
 * 
 * This script generates all the necessary keypairs for testing and
 * stores them in the dotenv.org vault for secure management.
 */

const { Keypair } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const bs58 = require('bs58');
const { execSync } = require('child_process');

// Check if dotenv-vault CLI is installed
try {
  execSync('npx dotenv-vault --version', { stdio: 'ignore' });
} catch (error) {
  console.error('\n❌ dotenv-vault CLI is not available');
  console.log('Installing dotenv-vault CLI...');
  execSync('npm install -g dotenv-vault', { stdio: 'inherit' });
}

// Directory for storing keypairs
const KEY_DIR = path.join(__dirname, '..', 'keys', 'test');

// Create directory if it doesn't exist
if (!fs.existsSync(KEY_DIR)) {
  fs.mkdirSync(KEY_DIR, { recursive: true });
}

// Function to generate a keypair and save it to a file
function generateAndSaveKeypair(name) {
  const keypair = Keypair.generate();
  const keyData = Buffer.from(keypair.secretKey);
  const keyPath = path.join(KEY_DIR, `${name}.json`);
  
  // Save keypair to file
  fs.writeFileSync(
    keyPath,
    JSON.stringify(Array.from(keypair.secretKey)),
    'utf-8'
  );
  
  return {
    keypair,
    keyPath,
    publicKey: keypair.publicKey.toBase58(),
    secretKey: bs58.encode(keypair.secretKey)
  };
}

// List of keypairs to generate
const keypairsToGenerate = [
  'payer',
  'mintAuthority',
  'freezeAuthority',
  'transferFeeAuthority',
  'kycAuthority',
  'treasuryAuthority',
  'governanceAuthority',
  'regulatorAuthority',
  'confidentialTransferMintAuthority'
];

// Generate all keypairs
console.log('Generating test keypairs...');
const generatedKeypairs = {};

keypairsToGenerate.forEach(name => {
  console.log(`Generating ${name} keypair...`);
  generatedKeypairs[name] = generateAndSaveKeypair(name);
});

// Generate .env content for testing
let envContent = '';
envContent += '# Test Environment Keypairs\n';
envContent += '# These keys are for testing purposes only\n\n';

Object.entries(generatedKeypairs).forEach(([name, data]) => {
  envContent += `${name.toUpperCase()}_KEYPAIR=${data.keyPath}\n`;
  envContent += `${name.toUpperCase()}_PUBKEY=${data.publicKey}\n`;
});

// Output to .env.test file
const envTestPath = path.join(__dirname, '..', '.env.test');
fs.writeFileSync(envTestPath, envContent, 'utf-8');

console.log(`\nAll keypairs generated in ${KEY_DIR}`);
console.log(`Environment variables written to ${envTestPath}`);

// Store in dotenv vault
console.log('\nStoring test keys in dotenv.org vault...');

try {
  // Create a temporary .env.test-vault file
  const envVaultPath = path.join(__dirname, '..', '.env.test-vault');
  fs.writeFileSync(envVaultPath, envContent, 'utf-8');

  // Push to the dotenv.org vault using the CLI
  console.log('Pushing to dotenv.org vault...');
  try {
    execSync('cd .. && npx dotenv-vault push test .env.test-vault', { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    console.log('\n✅ Successfully stored test keys in dotenv.org vault');
  } catch (error) {
    console.error('\n❌ Failed to push to dotenv.org vault');
    console.error(error.message);
    console.log('\nTo manually push to the vault, run:');
    console.log('npx dotenv-vault push test .env.test-vault');
  }

  // Clean up the temporary file
  fs.unlinkSync(envVaultPath);
} catch (error) {
  console.error('\n❌ Error storing keys in dotenv.org vault:', error.message);
}

// Output instructions for using keypairs
console.log('\nTo use these test keypairs:');
console.log('1. Pull the test environment variables from the vault:');
console.log('   $ npx dotenv-vault pull test');
console.log('2. Run the test environment setup:');
console.log('   $ ./scripts/setup-test-env.sh');
console.log('3. Run your tests with:');
console.log('   $ npm test'); 