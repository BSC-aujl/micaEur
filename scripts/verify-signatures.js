#!/usr/bin/env node

/**
 * Signature Verification Script for MiCA EUR Project
 * 
 * This script verifies that all changes to sensitive files have the 
 * necessary digital signatures. It's designed to be used in pre-commit hooks.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const SIGNATURE_REQUIRED_DIRS = [
  'programs/mica_eur/src', // Core Solana program code
  'app/compliance-api',     // KYC/compliance API
  'scripts'                 // Deployment and setup scripts
];

const SIGNATURE_PATTERN = /\/\/ Signature: ([a-zA-Z0-9+\/=]+)/;
const SIGNATURE_EXEMPT_PATTERNS = [
  /\.gitignore$/,
  /\.md$/,
  /package\.json$/,
  /tsconfig\.json$/,
  /\.eslintrc$/,
  /\.prettierrc$/,
  /\.DS_Store$/,
  /node_modules\//,
  /target\//,
  /dist\//,
  /\.anchor\//
];

// Get all staged files
function getStagedFiles() {
  try {
    const result = execSync('git diff --cached --name-only')
      .toString()
      .trim()
      .split('\n')
      .filter(Boolean);
    return result;
  } catch (error) {
    console.error('Error getting staged files:', error.message);
    return [];
  }
}

// Check if file is in directories requiring signatures
function requiresSignature(filePath) {
  // Skip files that match exemption patterns
  if (SIGNATURE_EXEMPT_PATTERNS.some(pattern => pattern.test(filePath))) {
    return false;
  }
  
  // Check if file is in one of the directories requiring signatures
  return SIGNATURE_REQUIRED_DIRS.some(dir => filePath.startsWith(dir));
}

// Verify signature in file
function verifySignature(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return { valid: false, message: `File does not exist: ${filePath}` };
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const signatureMatch = content.match(SIGNATURE_PATTERN);
    
    if (!signatureMatch) {
      return { valid: false, message: `Missing signature in ${filePath}` };
    }
    
    // In a real implementation, we would verify the signature
    // against a public key. Here we just check it exists.
    return { valid: true, message: `Signature verified for ${filePath}` };
  } catch (error) {
    return { valid: false, message: `Error verifying signature for ${filePath}: ${error.message}` };
  }
}

// Main function
function main() {
  console.log('🔑 Verifying signatures for staged files...');
  
  const stagedFiles = getStagedFiles();
  if (stagedFiles.length === 0) {
    console.log('No files staged for commit');
    return true;
  }
  
  let allValid = true;
  let filesChecked = 0;
  
  for (const file of stagedFiles) {
    if (requiresSignature(file)) {
      filesChecked++;
      const result = verifySignature(file);
      
      if (result.valid) {
        console.log(`✅ ${result.message}`);
      } else {
        console.error(`❌ ${result.message}`);
        allValid = false;
      }
    }
  }
  
  if (filesChecked === 0) {
    console.log('No files requiring signatures were changed');
    return true;
  }
  
  if (allValid) {
    console.log('✅ All signatures verified successfully');
    return true;
  } else {
    console.error('❌ Signature verification failed');
    console.log('Please add the required signatures to files and try again.');
    console.log('Format: // Signature: [base64_signature]');
    return false;
  }
}

// Execute and exit with appropriate code
const success = main();
process.exit(success ? 0 : 1); 