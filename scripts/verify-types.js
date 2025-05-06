#!/usr/bin/env node

/**
 * Type Verification Script for MiCA EUR Project
 *
 * This script verifies that all functions and programs have proper type
 * signatures for inputs and outputs. It checks Rust code for proper type
 * annotations and TypeScript code for proper interfaces and types.
 */

// Signature: ZHVtbXlfc2lnbmF0dXJlX2Zvcl92ZXJpZnlfdHlwZXNfc2NyaXB0

/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unused-vars */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Configuration
const RUST_FILES_PATTERN = /\.rs$/;
const TS_FILES_PATTERN = /\.(ts|tsx)$/;
const EXCLUDE_PATTERNS = [
  /node_modules\//,
  /target\//,
  /dist\//,
  /\.anchor\//,
  /tests\/fixtures\//,
];

// Allowlist for files that can use 'any' type (e.g., test files with type compatibility issues)
const ANY_TYPE_ALLOWLIST = [
  "tests/e2e/compliance-flow.test.ts",
  "tests/unit/blacklist-functionality.test.ts",
  "tests/utils/mock-setup.ts",
];

// Type patterns to check
const RUST_TYPE_PATTERNS = {
  // Check for proper Result return type in public functions
  publicFunctionReturnType: /pub fn\s+\w+\s*\([^)]*\)\s*->\s*Result<([^>]*)>/g,

  // Check for proper type annotations in function parameters
  functionParams: /fn\s+\w+\s*\(([^)]*)\)/g,

  // Check for account type definitions
  accountStructs: /#\[account\]\s*pub struct\s+(\w+)/g,

  // Check for proper derive macros on structs that should have them
  deriveMacros: /#\[derive\(([^)]*)\)\]\s*pub struct/g,
};

const TS_TYPE_PATTERNS = {
  // Check for typed function parameters
  functionParams: /function\s+\w+\s*\(([^)]*)\)\s*:\s*([^{]*)/g,

  // Check for typed variables
  typedVariables: /(?:const|let|var)\s+\w+\s*:\s*([^=;]*)/g,

  // Check for interface definitions
  interfaces: /interface\s+(\w+)/g,

  // Check for imported types
  importedTypes: /import\s+{\s*([^}]*)\s*}\s+from/g,
};

// Get all staged files
function getStagedFiles() {
  try {
    const result = execSync("git diff --cached --name-only")
      .toString()
      .trim()
      .split("\n")
      .filter(Boolean);
    return result;
  } catch (error) {
    console.error("Error getting staged files:", error.message);
    return [];
  }
}

// Check if a file should be verified
function shouldVerifyFile(filePath) {
  // Skip excluded paths
  if (EXCLUDE_PATTERNS.some((pattern) => pattern.test(filePath))) {
    return false;
  }

  // Only check Rust and TypeScript files
  return RUST_FILES_PATTERN.test(filePath) || TS_FILES_PATTERN.test(filePath);
}

// Verify Rust file types
function verifyRustTypes(filePath, content) {
  const issues = [];

  // Check return types of public functions
  const publicFunctionMatches = [
    ...content.matchAll(RUST_TYPE_PATTERNS.publicFunctionReturnType),
  ];
  for (const match of publicFunctionMatches) {
    const returnType = match[1];
    if (!returnType || returnType.trim() === "") {
      issues.push(
        `Function at position ${match.index} is missing a proper return type`
      );
    }
  }

  // Check function parameters
  const functionParamMatches = [
    ...content.matchAll(RUST_TYPE_PATTERNS.functionParams),
  ];
  for (const match of functionParamMatches) {
    const params = match[1];
    if (params && !params.trim().includes(":")) {
      issues.push(
        `Function parameters at position ${match.index} are missing type annotations`
      );
    }
  }

  // Check account structs
  const accountStructMatches = [
    ...content.matchAll(RUST_TYPE_PATTERNS.accountStructs),
  ];
  if (accountStructMatches.length > 0) {
    // Check that we have appropriate derive macros
    const deriveMacroMatches = [
      ...content.matchAll(RUST_TYPE_PATTERNS.deriveMacros),
    ];
    if (deriveMacroMatches.length < accountStructMatches.length) {
      issues.push(`Some account structs are missing derive macros`);
    }
  }

  return issues;
}

// Verify TypeScript file types
function verifyTsTypes(filePath, content) {
  const issues = [];

  // Check function parameter types
  const functionParamMatches = [
    ...content.matchAll(TS_TYPE_PATTERNS.functionParams),
  ];
  for (const match of functionParamMatches) {
    const params = match[1];
    // Check if parameters have type annotations (looking for a colon followed by a type)
    if (params && !params.includes(":") && params.trim() !== "") {
      issues.push(
        `Function parameters at position ${match.index} are missing type annotations`
      );
    }
  }

  // Check for any usage - but skip files in the allowlist
  if (
    !ANY_TYPE_ALLOWLIST.includes(filePath) &&
    (content.includes(": any") || content.includes("as any"))
  ) {
    issues.push(`File uses 'any' type which should be avoided for type safety`);
  }

  return issues;
}

// Verify file types
function verifyFileTypes(filePath) {
  try {
    // Check if file exists first - exit early with error if not
    if (!fs.existsSync(filePath)) {
      console.log(`Skipping non-existent file: ${filePath}`);
      return { valid: true, issues: [] };
    }

    const content = fs.readFileSync(filePath, "utf8");
    let issues = [];

    if (RUST_FILES_PATTERN.test(filePath)) {
      issues = verifyRustTypes(filePath, content);
    } else if (TS_FILES_PATTERN.test(filePath)) {
      issues = verifyTsTypes(filePath, content);
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  } catch (error) {
    return {
      valid: false,
      issues: [`Error verifying types for ${filePath}: ${error.message}`],
    };
  }
}

// Main function
function main() {
  console.log("🔍 Verifying type signatures for staged files...");

  const stagedFiles = getStagedFiles();
  if (stagedFiles.length === 0) {
    console.log("No files staged for commit");
    return true;
  }

  let allValid = true;
  let filesChecked = 0;

  for (const file of stagedFiles) {
    if (shouldVerifyFile(file)) {
      filesChecked++;
      const result = verifyFileTypes(file);

      if (result.valid) {
        console.log(`✅ Types verified for ${file}`);
      } else {
        console.error(`❌ Type issues in ${file}:`);
        result.issues.forEach((issue) => console.error(`   - ${issue}`));
        allValid = false;
      }
    }
  }

  if (filesChecked === 0) {
    console.log("No files requiring type verification were changed");
    return true;
  }

  if (allValid) {
    console.log("✅ All type signatures verified successfully");
    return true;
  } else {
    console.error("❌ Type verification failed");
    console.log("Please add proper type annotations to files and try again.");
    return false;
  }
}

// Execute and exit with appropriate code
const success = main();
process.exit(success ? 0 : 1);
