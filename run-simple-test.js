#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Get program ID from IDL file
const idlPath = path.join(process.cwd(), 'target', 'idl', 'mica_eur.json');
let programId = 'MicaEUrZV5ukPdyVLkRRNr5z95sJzXDvRrxtJ3qTMDP'; // Default fallback

try {
  if (fs.existsSync(idlPath)) {
    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
    if (idl.metadata && idl.metadata.address) {
      programId = idl.metadata.address;
      console.log(`Using program ID from IDL metadata: ${programId}`);
    }
  } else {
    console.warn(`IDL file not found at ${idlPath}, using default program ID`);
  }
} catch (err) {
  console.error('Error reading IDL file:', err);
}

// Set environment variables for tests
process.env.PROGRAM_ID = programId;
process.env.ANCHOR_PROVIDER_URL = process.env.ANCHOR_PROVIDER_URL || 'http://localhost:8899';

// Run the test
const test = process.argv[2] || 'tests/simple-test.ts';
const testPath = path.join(process.cwd(), test);

console.log(`Running test: ${testPath}`);

// Run using ts-node directly to bypass ts-mocha and avoid the env-setup.ts loading
const testProcess = spawn('npx', ['ts-node', '--project', 'tsconfig.json', testPath], {
  stdio: 'inherit',
  env: process.env
});

testProcess.on('close', (code) => {
  process.exit(code);
}); 