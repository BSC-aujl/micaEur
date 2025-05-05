#!/usr/bin/env node

/**
 * Test Creation Script
 *
 * This script creates a new test file from the template.
 * Usage: node create-test.js <test-name>
 * Example: node create-test.js token-transfer
 */

/* eslint-disable @typescript-eslint/no-var-requires, no-console */
const fs = require("fs");
const path = require("path");

// Color codes for console output
const COLOR = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

// Log message with color
function log(message, color = COLOR.reset) {
  console.log(`${color}${message}${COLOR.reset}`);
}

// Main function
function main() {
  const testName = process.argv[2];

  if (!testName) {
    log("Error: Test name is required", COLOR.red);
    log("Usage: node create-test.js <test-name>", COLOR.yellow);
    log("Example: node create-test.js token-transfer", COLOR.yellow);
    process.exit(1);
  }

  // Format test name
  const formattedName = testName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  // Create file name
  const fileName = `${formattedName}.test.ts`;
  const templatePath = path.join(
    process.cwd(),
    "tests",
    "templates",
    "test-template.ts"
  );
  const targetPath = path.join(
    process.cwd(),
    "tests",
    "new-approach",
    fileName
  );

  // Check if template exists
  if (!fs.existsSync(templatePath)) {
    log(`Error: Template file not found at ${templatePath}`, COLOR.red);
    process.exit(1);
  }

  // Check if target already exists
  if (fs.existsSync(targetPath)) {
    log(`Error: Test file already exists at ${targetPath}`, COLOR.red);
    log(
      "Please choose a different name or delete the existing file.",
      COLOR.yellow
    );
    process.exit(1);
  }

  // Read template
  let templateContent;
  try {
    templateContent = fs.readFileSync(templatePath, "utf8");
  } catch (error) {
    log(`Error reading template: ${error.message}`, COLOR.red);
    process.exit(1);
  }

  // Replace feature name
  const titleCaseName = formattedName
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const modifiedContent = templateContent
    .replace(/Feature Name/g, titleCaseName)
    .replace(
      /Sub-feature or Component/g,
      `${titleCaseName} Basic Functionality`
    );

  // Write to target
  try {
    fs.writeFileSync(targetPath, modifiedContent);
    log(`✅ Created new test file: ${fileName}`, COLOR.green);
    log(`Path: ${targetPath}`, COLOR.cyan);
    log("\nYou can run this test with:", COLOR.bright);
    log(
      `  npx ts-mocha -p ./tests/tsconfig.json ${targetPath} --timeout 60000`,
      COLOR.cyan
    );
    log("or", COLOR.bright);
    log(`  npm run test:runner -- ${formattedName}`, COLOR.cyan);
  } catch (error) {
    log(`Error creating test file: ${error.message}`, COLOR.red);
    process.exit(1);
  }
}

// Run the script
main();
