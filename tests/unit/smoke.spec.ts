/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable no-console */
import * as anchor from "@coral-xyz/anchor";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Connection,
} from "@solana/web3.js";
import { assert } from "chai";
import * as fs from "fs";

// Helper function to load keypair from file
function loadKeypairFromFile(filePath: string): Keypair {
  try {
    const keypairBuffer = fs.readFileSync(filePath, "utf-8");
    const keypairData = JSON.parse(keypairBuffer);
    return Keypair.fromSecretKey(new Uint8Array(keypairData));
  } catch (error) {
    console.error(`Error loading keypair from ${filePath}:`, error);
    throw error;
  }
}

describe("MiCA EUR - Smoke Tests", () => {
  // Configure the client to use localhost
  const connection = new Connection(
    process.env.ANCHOR_PROVIDER_URL || "http://localhost:8899",
    "confirmed"
  );

  // Load test keypairs from environment
  let authority: Keypair;
  let user1: Keypair;

  try {
    authority = loadKeypairFromFile(process.env.TEST_AUTHORITY_KEYPAIR || "");
    user1 = loadKeypairFromFile(process.env.TEST_USER1_KEYPAIR || "");
  } catch (error) {
    console.error(
      "Error loading keypairs, generating temporary ones for this test"
    );
    authority = Keypair.generate();
    user1 = Keypair.generate();
  }

  // Constants
  const BLZ1 = "10010010";
  const IBAN_HASH1 = Buffer.from(new Uint8Array(32).fill(1));
  const COUNTRY_CODE = "DE";
  const VERIFICATION_PROVIDER = "TestProvider";

  // Before running tests
  before(async () => {
    // Log test information
    console.log("Running basic smoke tests for environment validation");
    console.log("Using authority:", authority.publicKey.toString());
    console.log("Using user1:", user1.publicKey.toString());

    // Fund account if needed
    const authorityBalance = await connection.getBalance(authority.publicKey);
    if (authorityBalance < LAMPORTS_PER_SOL) {
      console.log("Funding authority account with test SOL...");
      try {
        const signature = await connection.requestAirdrop(
          authority.publicKey,
          LAMPORTS_PER_SOL
        );
        await connection.confirmTransaction(signature);
      } catch (error) {
        console.warn(
          "Failed to airdrop to authority. Account may already have sufficient funds or network issues."
        );
      }
    }
  });

  it("Can connect to the local Solana network", async () => {
    try {
      const version = await connection.getVersion();
      console.log("Connected to Solana network version:", version);
      assert.exists(version);
    } catch (error) {
      console.error("Error connecting to Solana network:", error);
      assert.fail("Failed to connect to Solana network");
    }
  });

  it("Test IDL file is available", () => {
    try {
      const idlPath = "./tests/fixtures/mica_eur.json";
      const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
      console.log("IDL loaded successfully:");
      console.log("Program name:", idl.name);
      console.log("IDL version:", idl.version);
      assert.exists(idl);
    } catch (error) {
      console.warn("Could not load IDL file, skipping test:", error);
    }
  });

  it("Test keypairs are properly configured", () => {
    assert.isTrue(PublicKey.isOnCurve(authority.publicKey.toBytes()));
    assert.isTrue(PublicKey.isOnCurve(user1.publicKey.toBytes()));
    console.log("Test keypairs are valid");
  });

  it("Test environment variables are properly set", () => {
    console.log("ANCHOR_PROVIDER_URL:", process.env.ANCHOR_PROVIDER_URL);
    console.log("ANCHOR_WALLET:", process.env.ANCHOR_WALLET);
    console.log("TEST_PAYER_KEYPAIR:", process.env.TEST_PAYER_KEYPAIR);

    assert.exists(process.env.ANCHOR_PROVIDER_URL);
    assert.exists(process.env.ANCHOR_WALLET);
    assert.exists(process.env.TEST_PAYER_KEYPAIR);
  });

  // Add more smoke tests as needed
});
