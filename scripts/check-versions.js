#!/usr/bin/env node

/**
 * Script to check and display version information for the project
 * Run with: node scripts/check-versions.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Path to the Rust versions file
const versionsRustPath = path.join(__dirname, '..', 'programs', 'mica_eur', 'src', 'versions.rs');
// Path to package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
// Path to Cargo.toml
const cargoTomlPath = path.join(__dirname, '..', 'programs', 'mica_eur', 'Cargo.toml');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Print header
console.log(`${colors.bright}${colors.cyan}========================================${colors.reset}`);
console.log(`${colors.bright}${colors.cyan}       MiCA EUR Version Check${colors.reset}`);
console.log(`${colors.bright}${colors.cyan}========================================${colors.reset}`);

// Check if Solana CLI is installed
try {
  const solanaVersion = execSync('solana --version').toString().trim();
  console.log(`\n${colors.bright}Solana CLI:${colors.reset} ${colors.green}${solanaVersion}${colors.reset}`);
} catch (error) {
  console.log(`\n${colors.bright}Solana CLI:${colors.reset} ${colors.red}Not installed or not in PATH${colors.reset}`);
}

// Check if Anchor is installed
try {
  const anchorVersion = execSync('anchor --version').toString().trim();
  console.log(`${colors.bright}Anchor CLI:${colors.reset} ${colors.green}${anchorVersion}${colors.reset}`);
} catch (error) {
  console.log(`${colors.bright}Anchor CLI:${colors.reset} ${colors.red}Not installed or not in PATH${colors.reset}`);
}

// Read package.json for JS dependencies
try {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  console.log(`\n${colors.bright}${colors.yellow}JavaScript Dependencies:${colors.reset}`);
  
  const formatVersion = (version) => {
    if (version.startsWith('^') || version.startsWith('~')) {
      return `${colors.yellow}${version}${colors.reset}`;
    }
    return `${colors.green}${version}${colors.reset}`;
  };
  
  const deps = packageJson.dependencies || {};
  const devDeps = packageJson.devDependencies || {};
  
  console.log(`\n${colors.bright}Dependencies:${colors.reset}`);
  Object.entries(deps).forEach(([name, version]) => {
    console.log(`  ${name}: ${formatVersion(version)}`);
  });
  
  console.log(`\n${colors.bright}Dev Dependencies:${colors.reset}`);
  Object.entries(devDeps).forEach(([name, version]) => {
    console.log(`  ${name}: ${formatVersion(version)}`);
  });
} catch (error) {
  console.log(`\n${colors.red}Error reading package.json: ${error.message}${colors.reset}`);
}

// Read Cargo.toml for Rust dependencies
try {
  const cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
  console.log(`\n${colors.bright}${colors.yellow}Rust Dependencies:${colors.reset}`);
  
  // Simple regex-based parsing (not a full TOML parser, but works for our needs)
  const workspaceSection = cargoToml.match(/\[workspace\.dependencies\]([\s\S]*?)(\[|\n\n|$)/);
  if (workspaceSection) {
    const depsSection = workspaceSection[1];
    const deps = depsSection.trim().split('\n').map(line => {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('#') || !trimmedLine) return null;
      
      if (trimmedLine.includes('{')) {
        // For dependencies with features
        const name = trimmedLine.split('=')[0].trim();
        return { name, version: trimmedLine.split('=')[1].trim() };
      } else {
        // For simple dependencies
        const [name, version] = trimmedLine.split('=').map(part => part.trim());
        return { name, version: version.replace(/["']/g, '') };
      }
    }).filter(Boolean);
    
    deps.forEach(dep => {
      if (dep) {
        console.log(`  ${colors.bright}${dep.name}:${colors.reset} ${colors.green}${dep.version}${colors.reset}`);
      }
    });
  }
} catch (error) {
  console.log(`\n${colors.red}Error reading Cargo.toml: ${error.message}${colors.reset}`);
}

console.log(`\n${colors.bright}${colors.cyan}========================================${colors.reset}`);
console.log(`${colors.bright}${colors.cyan}           Check Complete${colors.reset}`);
console.log(`${colors.bright}${colors.cyan}========================================${colors.reset}`); 