#!/usr/bin/env node

/**
 * Initialize dotenv.org for MiCA EUR project
 * 
 * This script helps setup dotenv.org for secure environment variable management
 * Run with: node scripts/initialize-dotenv.js
 */

const fs = require('fs');
const path = require('path');

// Check if .env file exists, if not create from example
if (!fs.existsSync(path.join(process.cwd(), '.env'))) {
  console.log('Creating .env file from .env.example...');
  fs.copyFileSync(
    path.join(process.cwd(), '.env.example'),
    path.join(process.cwd(), '.env')
  );
  console.log('.env file created. Please fill in your actual values.');
}

// Instructions for dotenv.org setup
console.log('\n=== DOTENV.ORG SETUP INSTRUCTIONS ===');
console.log('1. Install dotenvx CLI: npm install -g @dotenvx/dotenvx');
console.log('2. Initialize dotenv.org: npx dotenvx init');
console.log('3. Push your .env file to dotenv.org: npx dotenvx push');
console.log('4. Generate access keys: npx dotenvx keys');
console.log('\nFor more information, visit: https://dotenv.org/docs');

// Add gitignore entry if needed
const gitignorePath = path.join(process.cwd(), '.gitignore');
if (fs.existsSync(gitignorePath)) {
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
  
  if (!gitignoreContent.includes('.env')) {
    console.log('\nAdding .env to .gitignore...');
    fs.appendFileSync(gitignorePath, '\n# Environment Variables\n.env\n.env.*\n!.env.example\n');
    console.log('.env added to .gitignore');
  }
}

console.log('\nDotenv setup completed. Remember to never commit your actual .env file to git!'); 