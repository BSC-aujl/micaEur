#!/usr/bin/env node

/**
 * Cargo Lock Version Checker
 *
 * This script checks if the Cargo.lock file has version=4, which is not compatible
 * with the current build setup. If version=4 is found, the script exits with an error.
 */

/* eslint-disable @typescript-eslint/no-var-requires, no-console */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get project root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const cargoLockPath = path.join(projectRoot, "Cargo.lock");

function checkCargoLockVersion() {
  console.log("🔍 Checking Cargo.lock version...");

  try {
    if (!fs.existsSync(cargoLockPath)) {
      console.warn("⚠️ Cargo.lock file not found!");
      return;
    }

    const content = fs.readFileSync(cargoLockPath, "utf8");
    const lines = content.split("\n");

    // Look for version line near the top of the file
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const match = lines[i].match(/^version\s*=\s*(\d+)\s*$/);
      if (match) {
        const version = parseInt(match[1], 10);
        if (version === 4) {
          console.error(
            "❌ ERROR: Cargo.lock has version=4, which is not supported."
          );
          console.error("   Please downgrade to version=3 by running:");
          console.error("   sed -i 's/^version = 4$/version = 3/' Cargo.lock");
          process.exit(1);
        } else if (version === 3) {
          console.log("✅ Cargo.lock has correct version=3");
        } else {
          console.warn(`⚠️ Cargo.lock has unexpected version=${version}`);
        }
        return;
      }
    }

    console.warn("⚠️ Could not find version line in Cargo.lock");
  } catch (err) {
    console.error("❌ Error reading Cargo.lock:", err.message);
    process.exit(1);
  }
}

// Run the check
checkCargoLockVersion();
