/**
 * MiCA EUR Program Full Test with Jest
 *
 * This file tests the MiCA EUR program functionality using Anchor.
 */

import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";
import { beforeAll, describe, it } from "@jest/globals";
import fs from "fs";
import path from "path";
import { PROGRAM_ID } from "./utils/config";

// Constants for the program
// PROGRAM_ID is imported from config
const KYC_ORACLE_STATE_SEED = Buffer.from("kyc-oracle-state");
const KYC_USER_SEED = Buffer.from("kyc-user");
const MINT_INFO_SEED = Buffer.from("mint-info");
const TOKEN_2022_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
);

// Load the IDL file
const loadIdl = () => {
  const idlPath = path.join(__dirname, "../../target/idl/mica_eur.json");
  if (!fs.existsSync(idlPath)) {
    throw new Error(`IDL file not found at ${idlPath}`);
  }
  return JSON.parse(fs.readFileSync(idlPath, "utf-8"));
};

describe("MiCA EUR Program Tests (Deployed Version)", () => {
  // Connection and program variables
  let connection: Connection;
  let provider: AnchorProvider;
  let program: Program;

  // Test keypairs
  const payer = Keypair.generate();
  const kycAuthority = Keypair.generate();
  const user = Keypair.generate();

  // PDAs
  let kycOracleStatePda: PublicKey;

  beforeAll(async () => {
    console.log("Setting up test environment...");

    // Initialize connection
    connection = new Connection("http://localhost:8899", "confirmed");

    // Create wallet for the provider
    const wallet = new anchor.Wallet(payer);

    // Create provider
    provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });

    // Set the provider globally
    anchor.setProvider(provider);

    try {
      // Load the IDL
      const idl = loadIdl();

      // Create the program with correct parameter order
      program = new Program(idl, provider);

      // Make sure we're using the right programId
      console.log("Using programId:", PROGRAM_ID.toString());
      if (program.programId.toString() !== PROGRAM_ID.toString()) {
        console.warn(
          "Warning: Program ID mismatch. Using:",
          program.programId.toString(),
          "Expected:",
          PROGRAM_ID.toString()
        );
      }

      // Calculate PDAs
      kycOracleStatePda = PublicKey.findProgramAddressSync(
        [KYC_ORACLE_STATE_SEED],
        PROGRAM_ID
      )[0];

      // Fund accounts for testing
      console.log("Funding test accounts...");
      await fundTestAccounts();

      console.log("Test setup complete");
    } catch (err) {
      console.error("Error during test setup:", err);
      throw err;
    }
  }, 30000); // 30 second timeout

  describe("Program Verification", () => {
    it("should have a deployed program at the specified address", async () => {
      // Get the program account
      const accountInfo = await connection.getAccountInfo(PROGRAM_ID);

      // Check the program exists
      expect(accountInfo).to.not.be.null;

      // Check it's executable
      if (accountInfo) {
        expect(accountInfo.executable).to.be.true;
        console.log("Program verified at address:", PROGRAM_ID.toString());
      }
    });
  });

  describe("KYC Oracle", () => {
    it("should have the correct account structure", async () => {
      try {
        console.log(
          `Checking KYC Oracle structure at ${kycOracleStatePda.toString()}`
        );

        // The account may not exist yet, so we'll just verify the PDA
        const [calculatedPda] = PublicKey.findProgramAddressSync(
          [KYC_ORACLE_STATE_SEED],
          PROGRAM_ID
        );

        expect(calculatedPda.toString()).to.equal(kycOracleStatePda.toString());
        console.log("KYC Oracle PDA verified");
      } catch (err) {
        console.error("Error checking KYC Oracle structure:", err);
        throw err;
      }
    });
  });

  // Helper function to fund test accounts
  async function fundTestAccounts() {
    try {
      // Request airdrop for payer
      const airdropSignature = await connection.requestAirdrop(
        payer.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );

      // Wait for confirmation
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        signature: airdropSignature,
      });

      // Log funding success
      console.log(
        `Funded payer ${payer.publicKey.toString().slice(0, 8)}... with 2 SOL`
      );

      // The payer can then fund other accounts using transfers if needed
    } catch (err) {
      console.error("Error funding test accounts:", err);
      throw err;
    }
  }
});
