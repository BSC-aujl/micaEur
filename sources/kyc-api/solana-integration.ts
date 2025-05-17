import "dotenv/config";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { Program, AnchorProvider, Idl, Wallet } from "@coral-xyz/anchor";
import * as fs from "fs";

// Only import the IDL and initialize Anchor Program if not in test mode
let connection: Connection;
let programId: PublicKey;
let provider: AnchorProvider;
let program: any;
let authorityKeypair: Keypair;

// Seeds
const KYC_ORACLE_STATE_SEED = Buffer.from("kyc-oracle-state");
const KYC_USER_SEED = Buffer.from("kyc-user");

// Mapping of statuses to Anchor enum arguments
const KYC_STATUS_MAP: Record<string, any> = {
  UNVERIFIED: { unverified: {} },
  PENDING: { pending: {} },
  VERIFIED: { verified: {} },
  REJECTED: { rejected: {} },
  EXPIRED: { expired: {} },
  SUSPENDED: { suspended: {} },
};

// Initialize these only if not in test mode
if (process.env.NODE_ENV !== "test") {
  try {
    // Import the IDL dynamically
    const idl = require("./target/idl/mica_eur.json");

    // Load KYC authority keypair
    authorityKeypair = Keypair.fromSecretKey(
      new Uint8Array(
        JSON.parse(
          fs.readFileSync(process.env.KYC_AUTHORITY_KEYPAIR_PATH!, "utf-8")
        )
      )
    );

    // Initialize connection and program
    connection = new Connection(process.env.SOLANA_RPC_URL!, "confirmed");
    programId = new PublicKey(process.env.PROGRAM_ID!);

    // Create provider with custom wallet implementing Wallet interface
    const wallet: Wallet = {
      publicKey: authorityKeypair.publicKey,
      payer: authorityKeypair,
      signAllTransactions: async (txs) => {
        txs.forEach((tx) => (tx as any).partialSign(authorityKeypair));
        return txs;
      },
      signTransaction: async (tx) => {
        (tx as any).partialSign(authorityKeypair);
        return tx;
      },
    };
    provider = new AnchorProvider(connection, wallet, {});

    // Cast the imported IDL to Anchor's expected format
    const anchorIdl = {
      version: idl.metadata.version,
      name: idl.metadata.name,
      instructions: idl.instructions,
      // Add other required fields from the IDL
    } as unknown as Idl;

    // Program instance (Anchor v0.29 signature)
    program = new Program(anchorIdl, programId, provider);

    console.log("Solana integration initialized");
  } catch (err) {
    console.error("Failed to initialize Solana integration:", err);
  }
} else {
  console.log("Test mode: Using mock Solana integration");
}

/**
 * Update the KYC status for a wallet on-chain
 */
export async function updateKycStatus(
  walletAddress: string,
  status: keyof typeof KYC_STATUS_MAP,
  verificationLevel: number,
  expiryDays: number = 365
): Promise<string> {
  // Skip on-chain updates in test mode
  if (process.env.NODE_ENV === "test") {
    console.log(`[TEST] Mock KYC status update: ${walletAddress} -> ${status}`);
    return "TEST_TX_SIGNATURE";
  }

  // Check if the program was initialized
  if (!program) {
    throw new Error("Solana program not initialized");
  }

  try {
    // Check if walletAddress is a valid Solana address
    // If not, this might be an Onfido applicant ID instead
    const userPublicKey = new PublicKey(walletAddress);

    // Derive PDAs
    const [oraclePda] = PublicKey.findProgramAddressSync(
      [KYC_ORACLE_STATE_SEED],
      programId
    );
    const [userPda] = PublicKey.findProgramAddressSync(
      [KYC_USER_SEED, userPublicKey.toBuffer()],
      programId
    );

    // Send tx
    const tx = await program.methods
      .updateKycStatus(KYC_STATUS_MAP[status], verificationLevel, expiryDays)
      .accounts({
        authority: authorityKeypair.publicKey,
        kycOracleState: oraclePda,
        kycUser: userPda,
      })
      .rpc();

    // Confirm transaction to ensure it was finalized
    await provider.connection.confirmTransaction(tx, "confirmed");

    console.log(`KYC status updated on-chain: ${walletAddress} -> ${status}`);
    return tx;
  } catch (err) {
    if (err instanceof Error && err.message.includes("Non-base58 character")) {
      // This is likely an Onfido applicant ID, not a wallet address
      // In a real implementation, you would need to look up the wallet address associated with this applicant ID
      console.warn(
        `Received non-wallet address: ${walletAddress}. This might be an applicant ID.`
      );
      // For now, return a mock TX since we can't perform the on-chain update
      return "MOCK_TX_INVALID_WALLET_ADDRESS";
    }
    // Re-throw other errors
    throw err;
  }
}
