#!/usr/bin/env node

const {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} = require("@solana/web3.js");
const anchor = require("@coral-xyz/anchor");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Load the wallet key
function loadWalletKey(keypairFile) {
  try {
    const loaded = JSON.parse(fs.readFileSync(keypairFile, "utf8"));
    return Keypair.fromSecretKey(new Uint8Array(loaded));
  } catch (err) {
    console.error(`Error loading wallet key from ${keypairFile}: ${err}`);
    // Try to load as an array of numbers
    try {
      const loaded = Uint8Array.from(
        JSON.parse(fs.readFileSync(keypairFile, "utf8"))
      );
      return Keypair.fromSecretKey(loaded);
    } catch (err2) {
      console.error(`Failed second attempt: ${err2}`);
      throw err2;
    }
  }
}

// Function to create an Anchor-compatible instruction discriminator
function createInstructionDiscriminator(name) {
  return Buffer.from(
    crypto.createHash("sha256").update(`global:${name}`).digest()
  ).slice(0, 8);
}

// Find a PDA for the KYC Oracle state
async function findKycOraclePDA(programId) {
  const [pda, bump] = await PublicKey.findProgramAddress(
    [Buffer.from("kyc_oracle")],
    programId
  );
  return { pda, bump };
}

async function main() {
  try {
    console.log("Starting KYC Oracle test with Anchor 0.30.1");

    // 1. Set up the connection to the local Solana node
    const connection = new Connection("http://localhost:8899", "confirmed");

    // 2. Load the wallet for transaction signing
    const walletKeypairFile =
      process.env.WALLET_KEYPAIR ||
      path.join(require("os").homedir(), ".config", "solana", "id.json");
    const walletKeypair = loadWalletKey(walletKeypairFile);
    console.log("Using wallet:", walletKeypair.publicKey.toString());

    // 3. Set up the program ID
    const programId = new PublicKey(
      "HLGtQziz2QcYPohHCDGfiMATD6PN8rC8REPXbAGJTHgQ"
    );
    console.log("Using program ID:", programId.toString());

    // 4. Load the IDL (optional, but helpful for verification)
    let idl;
    try {
      idl = await anchor.Program.fetchIdl(
        programId,
        new anchor.AnchorProvider(
          connection,
          new anchor.Wallet(walletKeypair),
          {}
        )
      );
      console.log("Successfully fetched IDL.");
    } catch (error) {
      console.log("Warning: Failed to fetch IDL. Proceeding without it.");
      console.log(error);
    }

    // 5. Find the KYC Oracle PDA
    const { pda: kycOraclePDA, bump } = await findKycOraclePDA(programId);
    console.log("KYC Oracle PDA:", kycOraclePDA.toString());
    console.log("KYC Oracle bump:", bump);

    // 6. Try both approaches: Using Anchor Program or direct Transaction

    // Approach 1: Using Anchor Program (if IDL is available)
    if (idl) {
      try {
        const program = new anchor.Program(
          idl,
          programId,
          new anchor.AnchorProvider(
            connection,
            new anchor.Wallet(walletKeypair),
            {}
          )
        );

        console.log(
          "\nTrying to initialize KYC Oracle using Anchor Program..."
        );
        const tx = await program.methods
          .initializeKycOracle()
          .accounts({
            authority: walletKeypair.publicKey,
            oracleState: kycOraclePDA,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([walletKeypair])
          .rpc();

        console.log("Transaction successful:", tx);
        return;
      } catch (error) {
        console.log("Error using Anchor Program approach:", error);
        console.log("Falling back to direct transaction approach...");
      }
    }

    // Approach 2: Direct Transaction with instruction data
    console.log(
      "\nTrying to initialize KYC Oracle using direct transaction..."
    );

    // Generate the instruction discriminator for initialize_kyc_oracle
    const initializeKycOracleDiscriminator = createInstructionDiscriminator(
      "initialize_kyc_oracle"
    );
    console.log(
      "Using discriminator:",
      Buffer.from(initializeKycOracleDiscriminator).toString("hex")
    );

    // Create the instruction
    const instruction = {
      programId,
      keys: [
        { pubkey: walletKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: kycOraclePDA, isSigner: false, isWritable: true },
        {
          pubkey: anchor.web3.SystemProgram.programId,
          isSigner: false,
          isWritable: false,
        },
      ],
      data: initializeKycOracleDiscriminator,
    };

    // Create a transaction
    const transaction = new Transaction().add(instruction);

    // Send and confirm the transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [walletKeypair],
      { commitment: "confirmed" }
    );

    console.log("Transaction successful:", signature);

    // Try to fetch the KYC Oracle account data (if successful)
    try {
      const accountInfo = await connection.getAccountInfo(kycOraclePDA);
      console.log("KYC Oracle account exists:", accountInfo !== null);

      if (accountInfo) {
        console.log("Account data length:", accountInfo.data.length);
        console.log("Account owner:", accountInfo.owner.toString());
      }
    } catch (error) {
      console.log("Error fetching KYC Oracle account:", error);
    }
  } catch (error) {
    console.error("Error in main:", error);
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error("Program exited with error:", err);
    process.exit(1);
  }
);
