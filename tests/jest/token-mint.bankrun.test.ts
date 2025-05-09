/// <reference types="jest" />
// tslint:disable
import * as dotenv from "dotenv";
import { beforeAll, describe, test, expect } from "@jest/globals";
import * as anchor from "@coral-xyz/anchor";
import { Keypair, SystemProgram, PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import fs from "fs";
import path from "path";
// Load .env so process.env.PROGRAM_ID is available
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
import { startAnchor, ProgramTestContext } from "solana-bankrun";
import { BankrunConnection } from "../utils/bankrun-connection";

// Type for the parsed IDL with the fields we need
type ParsedIdl = {
  name: string;
  metadata: {
    address: string;
  };
};

describe("Token Mint (Bankrun)", () => {
  let ctx: ProgramTestContext;
  let provider: anchor.AnchorProvider;
  let program: anchor.Program;

  beforeAll(async () => {
    // Load IDL and extract program metadata
    try {
      const idlPath = path.join(
        process.cwd(),
        "target",
        "idl",
        "mica_eur.json"
      );
      console.log(`Loading IDL from: ${idlPath}`);

      if (!fs.existsSync(idlPath)) {
        throw new Error(`IDL file not found: ${idlPath}`);
      }

      const rawData = fs.readFileSync(idlPath, "utf8");
      console.log(`IDL file size: ${rawData.length} bytes`);

      // Parse the IDL
      const rawIdl = JSON.parse(rawData);
      const idl = rawIdl as anchor.Idl;
      const parsedIdl = rawIdl as ParsedIdl;

      // Check if metadata.address exists
      if (!parsedIdl.metadata || !parsedIdl.metadata.address) {
        throw new Error("IDL is missing metadata.address field");
      }

      console.log(`Program ID from IDL: ${parsedIdl.metadata.address}`);
      const programId = new PublicKey(parsedIdl.metadata.address);

      // Deploy our Anchor program into Bankrun
      const programPath = path.join(
        process.cwd(),
        "target",
        "deploy",
        "mica_eur.so"
      );
      console.log(`Loading program from: ${programPath}`);

      if (!fs.existsSync(programPath)) {
        throw new Error(`Program file not found: ${programPath}`);
      }

      ctx = await startAnchor(
        programPath,
        [{ name: parsedIdl.name, programId }],
        []
      );

      // Wrap Bankrun in a fake Connection and Anchor provider
      const conn = new BankrunConnection(ctx);
      provider = new anchor.AnchorProvider(
        conn,
        new anchor.Wallet(ctx.payer),
        {}
      );
      anchor.setProvider(provider);

      // Instantiate the Anchor Program client
      idl.address = parsedIdl.metadata.address;
      program = new anchor.Program(idl, provider);
    } catch (error) {
      console.error("Error in test setup:", error);
      throw error;
    }
  });

  test("initializes a Euro mint", async () => {
    // Skip test if setup failed
    if (!program) {
      console.warn("Skipping test due to setup failure");
      return;
    }

    try {
      const mintKeypair = Keypair.generate();
      // Derive the MintInfo PDA
      const [mintInfoPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("mint_info"), mintKeypair.publicKey.toBuffer()],
        program.programId
      );

      console.log("Initializing Euro mint...");
      // Call the Anchor RPC
      await program.methods
        .initializeEuroMint("https://example.com/whitepaper")
        .accounts({
          issuer: ctx.payer.publicKey,
          mintInfo: mintInfoPDA,
          mint: mintKeypair.publicKey,
          freezeAuthority: ctx.payer.publicKey,
          permanentDelegate: ctx.payer.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([ctx.payer, mintKeypair])
        .rpc();

      expect(mintKeypair.publicKey).toBeDefined();
      console.log("Euro mint initialized successfully");
    } catch (error) {
      console.error("Test error:", error);
      throw error;
    }
  });
});
