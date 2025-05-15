#!/usr/bin/env node

/**
 * Script to verify TypeScript types in the codebase
 * This runs the TypeScript compiler in type-checking mode only
 * to identify any type errors or inconsistencies
 */

import { execSync } from "child_process";
import path from "path";

console.log("🔍 Verifying TypeScript types...");

try {
  // Run TypeScript compiler in noEmit mode to check types only
  // Skip checking node_modules as they often have type errors we can't fix
  execSync("npx tsc --noEmit --skipLibCheck", { stdio: "inherit" });

  console.log("✅ TypeScript types verified successfully!");
  process.exit(0);
} catch (error) {
  console.error("❌ TypeScript type checking failed!");
  console.error("Please fix type errors before committing.");
  process.exit(1);
}
