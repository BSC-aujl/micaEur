#!/usr/bin/env node

/**
 * KYC Verification Levels Consistency Check
 * 
 * This script verifies that the KYC verification levels are consistent across the codebase.
 * It checks:
 * - The verification level constants match in all relevant files
 * - The permission logic is consistent with the documentation
 * - The test files are updated to match the verification level changes
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get project root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Files to check
const filesToCheck = [
  'tests/kyc-end-to-end-flow.ts',
  'docs/kyc-flow-guide.md'
];

// Expected verification levels
const EXPECTED_VERIFICATION_LEVELS = {
  UNVERIFIED: 0,    // Can transfer tokens but cannot mint or redeem
  BASIC: 1,         // Individual users with bank accounts, can mint and redeem
  STANDARD: 2,      // Business users with additional compliance checks
  ADVANCED: 3       // Institutional users, highest limits
};

// Expected operations by level (used in validation)
const EXPECTED_OPERATIONS = {
  UNVERIFIED: ['transfer'],
  BASIC: ['transfer', 'mint', 'redeem'],
  STANDARD: ['transfer', 'mint', 'redeem'],
  ADVANCED: ['transfer', 'mint', 'redeem']
};

console.log('🔍 Verifying KYC verification levels consistency...');

let hasErrors = false;

// Check each file
for (const relativeFilePath of filesToCheck) {
  const filePath = path.join(projectRoot, relativeFilePath);
  
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️ File not found: ${relativeFilePath}`);
    continue;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  
  // For TypeScript files, check verification level constants
  if (filePath.endsWith('.ts')) {
    console.log(`Checking ${relativeFilePath}...`);
    
    // Check for verification levels constant
    const verificationLevelMatch = content.match(/VERIFICATION_LEVELS\s*=\s*{[^}]+}/s);
    
    if (verificationLevelMatch) {
      const verificationLevelBlock = verificationLevelMatch[0];
      
      // Check each expected level
      for (const [level, value] of Object.entries(EXPECTED_VERIFICATION_LEVELS)) {
        const levelRegex = new RegExp(`${level}\\s*:\\s*(\\d+)`);
        const match = verificationLevelBlock.match(levelRegex);
        
        if (!match) {
          console.error(`❌ Missing verification level "${level}" in ${relativeFilePath}`);
          hasErrors = true;
        } else if (parseInt(match[1], 10) !== value) {
          console.error(`❌ Verification level "${level}" has incorrect value in ${relativeFilePath}. Expected ${value}, got ${match[1]}`);
          hasErrors = true;
        }
      }
    } else {
      console.warn(`⚠️ Could not find VERIFICATION_LEVELS constant in ${relativeFilePath}`);
    }
    
    // Check for permission consistency in comments
    if (content.includes('Unverified')) {
      const canTransfer = content.includes('Unverified User can transfer') || 
                          content.includes('unverified ones, can transfer');
      const cannotMint = content.includes('Unverified User lacks') || 
                         content.includes('simulation') && content.includes('mint') && content.includes('fail');
      
      if (!canTransfer) {
        console.warn(`⚠️ Could not confirm Unverified users can transfer in ${relativeFilePath}`);
      }
      
      if (!cannotMint) {
        console.warn(`⚠️ Could not confirm Unverified users cannot mint in ${relativeFilePath}`);
      }
    }
  }
  
  // For Markdown documentation files
  if (filePath.endsWith('.md')) {
    console.log(`Checking ${relativeFilePath}...`);
    
    // Check for verification level descriptions
    const hasUnverified = content.includes('Unverified') && content.includes('transfer') && !content.includes('Unverified.*mint');
    const hasBasic = content.includes('Basic Verification') && content.includes('Individual') && content.includes('mint') && content.includes('redeem');
    const hasStandard = content.includes('Standard Verification') && content.includes('Business') && content.includes('higher limits');
    const hasAdvanced = content.includes('Advanced Verification') && content.includes('Institutional');
    
    if (!hasUnverified) {
      console.error(`❌ Missing or incorrect Unverified level description in ${relativeFilePath}`);
      hasErrors = true;
    }
    
    if (!hasBasic) {
      console.error(`❌ Missing or incorrect Basic level description in ${relativeFilePath}`);
      hasErrors = true;
    }
    
    if (!hasStandard) {
      console.error(`❌ Missing or incorrect Standard level description in ${relativeFilePath}`);
      hasErrors = true;
    }
    
    if (!hasAdvanced) {
      console.error(`❌ Missing or incorrect Advanced level description in ${relativeFilePath}`);
      hasErrors = true;
    }
    
    // Check for permission table
    const hasTable = content.includes('| Operation | Unverified | Basic | Standard | Advanced |');
    
    if (hasTable) {
      // Validate operations based on expected operations
      for (const [level, operations] of Object.entries(EXPECTED_OPERATIONS)) {
        for (const operation of ['Transfer', 'Mint', 'Redeem']) {
          const lowerOpName = operation.toLowerCase();
          const shouldBeAllowed = operations.includes(lowerOpName);
          const expectedMarker = shouldBeAllowed ? '✅' : '❌';
          
          // Get the row for this operation
          const rowRegex = new RegExp(`\\|\\s*${operation}\\s*\\|[^\\|]*\\|[^\\|]*\\|[^\\|]*\\|[^\\|]*\\|`);
          const match = content.match(rowRegex);
          
          if (!match) {
            console.error(`❌ Missing ${operation} operation row in permission table in ${relativeFilePath}`);
            hasErrors = true;
            continue;
          }
          
          const row = match[0];
          
          // Extract marker for the specific level
          const levelNames = ['Unverified', 'Basic', 'Standard', 'Advanced'];
          const levelIndex = levelNames.findIndex(name => 
            name.toLowerCase() === level.toLowerCase());
          
          if (levelIndex === -1) {
            console.error(`❌ Unknown level: ${level}`);
            hasErrors = true;
            continue;
          }
          
          // Split by | and check the marker in the appropriate column
          const columns = row.split('|').map(col => col.trim());
          // columns[0] is empty, columns[1] is operation name, columns[2:5] are the markers
          const actualMarker = columns[levelIndex + 2];
          
          const hasExpectedMarker = actualMarker.includes(expectedMarker);
          if (!hasExpectedMarker) {
            console.error(`❌ Incorrect permission for ${level} level and ${operation} operation in ${relativeFilePath}`);
            console.error(`   Expected: ${expectedMarker}, Found: ${actualMarker}`);
            hasErrors = true;
          }
        }
      }
    } else {
      console.error(`❌ Missing permission table in ${relativeFilePath}`);
      hasErrors = true;
    }
  }
}

// Final result
if (hasErrors) {
  console.error('❌ KYC verification levels check failed!');
  process.exit(1);
} else {
  console.log('✅ KYC verification levels are consistent across the codebase!');
  process.exit(0);
} 