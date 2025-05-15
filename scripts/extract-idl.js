#!/usr/bin/env node

/**
 * Simple script to create a minimal IDL for MiCA EUR
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get program ID from keypair
function getProgramId() {
  const keypairPath = path.join(
    __dirname,
    "../target/deploy/mica_eur-keypair.json"
  );
  if (!fs.existsSync(keypairPath)) {
    console.error(
      'Keypair not found. Build the program first with "anchor build"'
    );
    process.exit(1);
  }

  const result = spawnSync("solana-keygen", ["pubkey", keypairPath], {
    encoding: "utf-8",
  });
  if (result.error) {
    console.error("Failed to get program ID:", result.error.message);
    process.exit(1);
  }

  return result.stdout.trim();
}

// Create directories
const idlDir = path.join(__dirname, "../target/idl");
if (!fs.existsSync(idlDir)) {
  fs.mkdirSync(idlDir, { recursive: true });
}

// Get program ID
const programId = getProgramId();
console.log("Program ID:", programId);

// Create minimal IDL
const minimalIdl = {
  version: "0.1.0",
  name: "mica_eur",
  instructions: [
    {
      name: "initialize",
      accounts: [],
      args: [],
    },
    {
      name: "initializeKycOracle",
      accounts: [
        { name: "authority", isMut: true, isSigner: true },
        { name: "kycOracleState", isMut: true, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
        { name: "rent", isMut: false, isSigner: false },
      ],
      args: [],
    },
    {
      name: "registerKycUser",
      accounts: [
        { name: "authority", isMut: true, isSigner: true },
        { name: "kycOracleState", isMut: false, isSigner: false },
        { name: "user", isMut: false, isSigner: false },
        { name: "kycUser", isMut: true, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
        { name: "rent", isMut: false, isSigner: false },
      ],
      args: [
        { name: "blz", type: "string" },
        { name: "ibanHash", type: "[u8;32]" },
        { name: "countryCode", type: "string" },
        { name: "verificationProvider", type: "string" },
      ],
    },
    {
      name: "updateKycStatus",
      accounts: [
        { name: "authority", isMut: true, isSigner: true },
        { name: "kycOracleState", isMut: true, isSigner: false },
        { name: "kycUser", isMut: true, isSigner: false },
      ],
      args: [
        { name: "status", type: { defined: "KycStatus" } },
        { name: "verificationLevel", type: "u8" },
        { name: "expiryDays", type: "i64" },
      ],
    },
  ],
  accounts: [
    {
      name: "KycUser",
      type: {
        kind: "struct",
        fields: [
          { name: "authority", type: "publicKey" },
          { name: "user", type: "publicKey" },
          { name: "status", type: { defined: "KycStatus" } },
          { name: "verificationLevel", type: "u8" },
          { name: "verificationTime", type: "i64" },
          { name: "expiryTime", type: "i64" },
          { name: "countryCode", type: "string" },
          { name: "blz", type: "string" },
          { name: "ibanHash", type: "[u8;32]" },
          { name: "verificationProvider", type: "string" },
        ],
      },
    },
    {
      name: "KycOracleState",
      type: {
        kind: "struct",
        fields: [
          { name: "authority", type: "publicKey" },
          { name: "userCount", type: "u64" },
          { name: "verifiedUserCount", type: "u64" },
          { name: "lastUpdateTime", type: "i64" },
        ],
      },
    },
    {
      name: "MintInfo",
      type: {
        kind: "struct",
        fields: [
          { name: "mint", type: "publicKey" },
          { name: "issuer", type: "publicKey" },
          { name: "freezeAuthority", type: "publicKey" },
          { name: "permanentDelegate", type: "publicKey" },
          { name: "whitepaperUri", type: "string" },
          { name: "isActive", type: "bool" },
          { name: "creationTime", type: "i64" },
          { name: "reserveMerkleRoot", type: "[u8;32]" },
          { name: "reserveIpfsCid", type: "string" },
          { name: "lastReserveUpdate", type: "i64" },
        ],
      },
    },
  ],
  types: [
    {
      name: "KycStatus",
      type: {
        kind: "enum",
        variants: [
          { name: "Unverified" },
          { name: "Pending" },
          { name: "Verified" },
          { name: "Rejected" },
          { name: "Expired" },
          { name: "Suspended" },
        ],
      },
    },
  ],
  metadata: {
    address: programId,
  },
};

// Write IDL to file
const idlPath = path.join(idlDir, "mica_eur.json");
fs.writeFileSync(idlPath, JSON.stringify(minimalIdl, null, 2));
console.log(`✅ Created minimal IDL at ${idlPath}`);

// Also copy to types directory
const typesDir = path.join(__dirname, "../target/types");
if (!fs.existsSync(typesDir)) {
  fs.mkdirSync(typesDir, { recursive: true });
}
fs.writeFileSync(
  path.join(typesDir, "mica_eur.json"),
  JSON.stringify(minimalIdl, null, 2)
);
console.log(`✅ Copied IDL to types directory`);

console.log("Done!");
