#!/usr/bin/env node

/**
 * Script to verify that all transaction signatures in the codebase are properly handled
 * It scans the codebase for transaction signatures and checks that they follow good practices:
 * - Using .confirmTransaction() after sending a transaction
 * - Checking for errors in the transaction status
 * - Handling any errors that might occur during transaction submission
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

console.log("🔍 Checking for potentially unsafe signature handling...");

// Get all TS files that contain signatures
const tsFiles = execSync('grep -r --include="*.ts" -l "\\.signatures" .', {
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean);

// Get all TS files that call .rpc() directly
const rpcCallFiles = execSync('grep -r --include="*.ts" -l "\\.rpc()" .', {
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean);

// Combine unique files
const allFilesToCheck = [...new Set([...tsFiles, ...rpcCallFiles])];

let foundIssues = false;
let issueCount = 0;

// Regular expressions to catch common issues
const patterns = [
  {
    regex: /\.rpc\(\)/g,
    shouldHave:
      /\.rpc\(\).*\.then\(|await.*\.rpc\(\).*try|confirmTransaction|ConfirmOptions/g,
    message: "Transaction sent without proper confirmation handling",
  },
  {
    regex: /\.sendTransaction\(/g,
    shouldHave:
      /\.confirmTransaction\(|\.confirmSignature\(|try\s*{[^}]*\.sendTransaction\(/g,
    message: "sendTransaction called without confirmation or error handling",
  },
];

allFilesToCheck.forEach((file) => {
  if (
    file.includes("node_modules") ||
    file.includes("target/") ||
    file.includes("dist/")
  ) {
    return; // Skip library files
  }

  try {
    const content = fs.readFileSync(file, "utf8");

    patterns.forEach((pattern) => {
      const matches = content.match(pattern.regex);

      if (matches) {
        const hasProperHandling = pattern.shouldHave.test(content);

        if (!hasProperHandling) {
          console.log(`⚠️  ${file}: ${pattern.message}`);
          console.log(
            `   Found ${matches.length} instances of potentially unsafe pattern`
          );
          foundIssues = true;
          issueCount += matches.length;
        }
      }
    });
  } catch (err) {
    console.log(`Error reading file ${file}: ${err.message}`);
  }
});

if (foundIssues) {
  console.log(
    `\n⚠️  Found ${issueCount} potential signature handling issues. Please ensure all transactions:`
  );
  console.log("   - Use confirmTransaction/confirmSignature after submission");
  console.log("   - Implement proper error handling with try/catch");
  console.log("   - Check for transaction success/failure status");
  process.exit(1);
} else {
  console.log("✅ No signature handling issues found!");
  process.exit(0);
}
