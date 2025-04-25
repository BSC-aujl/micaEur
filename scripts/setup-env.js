#!/usr/bin/env node

/**
 * This script helps developers set up their environment for the MiCA EUR project.
 * It initializes dotenv-vault and guides through environment setup.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n🔐 MiCA EUR Environment Setup\n');

// Check if .env exists, if not create from example
if (!fs.existsSync(path.join(__dirname, '../.env'))) {
  console.log('Creating .env file from example...');
  fs.copyFileSync(
    path.join(__dirname, '../.env.example'),
    path.join(__dirname, '../.env')
  );
}

console.log('\nWould you like to initialize dotenv-vault for secure environment management? (y/n)');
rl.question('> ', (answer) => {
  if (answer.toLowerCase() === 'y') {
    try {
      console.log('\nInitializing dotenv-vault...');
      execSync('npx dotenv-vault new', { stdio: 'inherit' });
      
      console.log('\nPushing local environment to vault...');
      execSync('npx dotenv-vault push', { stdio: 'inherit' });
      
      console.log('\n✅ Environment setup complete!');
      console.log('\nRecommended next steps:');
      console.log('1. Update the .env file with your actual credentials');
      console.log('2. Run `npx dotenv-vault push` to update your vault');
      console.log('3. Share access with team members using `npx dotenv-vault open`');
    } catch (error) {
      console.error('\n❌ Error initializing dotenv-vault:', error.message);
    }
  } else {
    console.log('\nSkipping dotenv-vault initialization.');
    console.log('Remember to manually update your .env file with actual credentials.');
  }
  
  console.log('\nFor more information on secure environment management, visit:');
  console.log('https://www.dotenv.org/docs\n');
  
  rl.close();
}); 