#!/usr/bin/env node

/**
 * Script to verify TypeScript types in the codebase
 * Filters out any errors coming from node_modules to avoid checking external libraries
 */
import { execSync } from "child_process";

console.log("🔍 Verifying TypeScript types (excluding node_modules)...");
try {
  // Run the compiler and capture output (allow errors)
  const rawOutput = execSync(
    "npx tsc --project tsconfig.check.json 2>&1 || true",
    { encoding: "utf8" }
  );
  // Filter out lines referencing node_modules
  const filteredOutput = rawOutput
    .split("\n")
    .filter((line) => !line.includes("node_modules"))
    .join("\n")
    .trim();

  if (filteredOutput) {
    console.error(filteredOutput);
    console.error("❌ TypeScript type checking failed!");
    process.exit(1);
  }

  console.log("✅ TypeScript types verified successfully!");
  process.exit(0);
} catch (error) {
  console.error("❌ Unexpected error during type checking:", error);
  process.exit(1);
}
