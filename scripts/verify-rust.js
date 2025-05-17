#!/usr/bin/env node

/**
 * Rust Code Verification Script
 *
 * This script checks Rust code quality by running cargo check on Rust source files.
 * It specifically focuses on Rust source code only, ignoring Anchor-generated files.
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("🔍 Verifying Rust code...");

// Get all Rust program directories with Cargo.toml files
function findRustProjects() {
  const programDirs = [];
  const searchDir = path.join(projectRoot, "sources/sol-programs");

  if (fs.existsSync(searchDir)) {
    const dirs = fs.readdirSync(searchDir);
    for (const dir of dirs) {
      const programDir = path.join(searchDir, dir);
      const cargoFile = path.join(programDir, "Cargo.toml");

      if (fs.existsSync(cargoFile) && fs.statSync(programDir).isDirectory()) {
        programDirs.push(programDir);
      }
    }
  }

  return programDirs;
}

try {
  const rustProjects = findRustProjects();

  if (rustProjects.length === 0) {
    console.log("⚠️ No Rust projects found in sources/sol-programs/");
    process.exit(0);
  }

  // Run cargo check on each Rust project
  for (const rustProject of rustProjects) {
    const projectName = path.basename(rustProject);
    console.log(`Checking Rust project: ${projectName}`);

    try {
      execSync("cargo check --lib --bins", {
        cwd: rustProject,
        stdio: "inherit",
      });
      console.log(`✅ ${projectName} Rust code verified successfully!`);
    } catch (error) {
      console.error(`❌ Rust code check failed for ${projectName}!`);
      process.exit(1);
    }
  }

  console.log("✅ All Rust code verified successfully!");
  process.exit(0);
} catch (error) {
  console.error("❌ Rust code verification failed!");
  console.error(error.message);
  process.exit(1);
}
