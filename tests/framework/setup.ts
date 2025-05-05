import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import os from "os";

// We'll use a direct import type without requiring the generated types
export type MicaEur = any;

/**
 * Test configuration interface
 */
export interface TestConfig {
  // Whether to use persistent keypairs from the file system
  usePersistentWallet: boolean;
  // Directory to store keypairs
  keypairDir: string;
  // Cluster URL
  clusterUrl: string;
  // Transaction commitment level
  txCommitment: anchor.web3.Commitment;
  // Amount to airdrop to each test account
  airdropAmount: number;
  // Path to the IDL file (if not using workspace)
  idlPath?: string;
  // Program ID
  programId?: string;
}

/**
 * Default test configuration
 */
export const DEFAULT_CONFIG: TestConfig = {
  usePersistentWallet: true,
  keypairDir: path.join(os.homedir(), ".config", "solana", "test-keypairs"),
  clusterUrl: "http://localhost:8899",
  txCommitment: "confirmed",
  airdropAmount: 1_000_000_000, // 1 SOL
  idlPath: path.join(process.cwd(), "target", "idl", "mica_eur.json"),
};

/**
 * Test context interface
 */
export interface TestContext {
  program: Program<MicaEur>;
  connection: Connection;
  wallet: anchor.Wallet;
  provider: AnchorProvider;
  keypairs: {
    authority: Keypair;
    user1: Keypair;
    user2: Keypair;
    user3: Keypair;
    [key: string]: Keypair;
  };
  accounts: {
    kycOracle?: PublicKey;
    kycUser?: PublicKey;
    kycUser1?: PublicKey;
    kycUser2?: PublicKey;
    euroMint?: PublicKey;
    mintInfo?: PublicKey;
    userTokenAccount?: PublicKey;
    tokenAccount1?: PublicKey;
    tokenAccount2?: PublicKey;
    [key: string]: PublicKey | undefined;
  };
}

/**
 * Setup the test context with the given configuration
 */
export async function setupTestContext(
  customConfig: Partial<TestConfig> = {}
): Promise<TestContext> {
  // Merge default config with custom config
  const config = { ...DEFAULT_CONFIG, ...customConfig };

  // Set up the wallet (either persistent or ephemeral)
  const keypairs = {
    authority: config.usePersistentWallet
      ? await getOrCreatePersistentWallet(config.keypairDir, "authority")
      : anchor.web3.Keypair.generate(),
    user1: config.usePersistentWallet
      ? await getOrCreatePersistentWallet(config.keypairDir, "user1")
      : anchor.web3.Keypair.generate(),
    user2: config.usePersistentWallet
      ? await getOrCreatePersistentWallet(config.keypairDir, "user2")
      : anchor.web3.Keypair.generate(),
    user3: config.usePersistentWallet
      ? await getOrCreatePersistentWallet(config.keypairDir, "user3")
      : anchor.web3.Keypair.generate(),
  };

  // Setup connection and provider
  const connection = new Connection(config.clusterUrl, config.txCommitment);
  const wallet = new anchor.Wallet(keypairs.authority);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: config.txCommitment,
    skipPreflight: false,
  });

  // Set the provider as the default
  anchor.setProvider(provider);

  // Get program ID from the environment, config, or use a default
  const programId = new PublicKey(
    config.programId ||
      process.env.PROGRAM_ID ||
      "HLGtQziz2QcYPohHCDGfiMATD6PN8rC8REPXbAGJTHgQ"
  );

  // Try to get the program from anchor workspace or load it from IDL file
  let program;
  try {
    if (anchor.workspace.MicaEur) {
      console.log("Using Anchor workspace program");
      program = anchor.workspace.MicaEur;
    } else {
      throw new Error("Program not found in workspace");
    }
  } catch (e) {
    console.log("Loading program from IDL file", config.idlPath);
    // Load IDL from file
    if (!config.idlPath || !fs.existsSync(config.idlPath)) {
      throw new Error(`IDL file not found at ${config.idlPath}`);
    }

    const idl = JSON.parse(fs.readFileSync(config.idlPath, "utf8"));
    program = new Program(idl, programId, provider);
  }

  // Create the test context
  const context: TestContext = {
    program: program as unknown as Program<MicaEur>,
    connection,
    wallet,
    provider,
    keypairs,
    accounts: {},
  };

  // Airdrop SOL to each test account if needed
  await fundAccounts(context, config.airdropAmount);

  return context;
}

/**
 * Fund test accounts with SOL
 */
async function fundAccounts(context: TestContext, amount: number) {
  // Airdrop SOL to each test keypair if their balance is low
  const keypairsToCheck = [
    context.keypairs.authority,
    context.keypairs.user1,
    context.keypairs.user2,
    context.keypairs.user3,
  ];

  for (const keypair of keypairsToCheck) {
    const balance = await context.connection.getBalance(keypair.publicKey);
    if (balance < amount / 2) {
      try {
        const signature = await context.connection.requestAirdrop(
          keypair.publicKey,
          amount
        );
        await context.connection.confirmTransaction(signature);
        console.log(
          `Airdropped ${amount / 1e9} SOL to ${keypair.publicKey.toString()}`
        );
      } catch (e) {
        console.error(
          `Failed to airdrop to ${keypair.publicKey.toString()}:`,
          e
        );
      }
    }
  }
}

/**
 * Get or create a persistent wallet
 */
async function getOrCreatePersistentWallet(
  dir: string,
  name: string
): Promise<Keypair> {
  // Create directory if it doesn't exist
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const keypairFile = path.join(dir, `${name}.json`);

  // If keypair file exists, load it
  if (fs.existsSync(keypairFile)) {
    const keypairData = JSON.parse(fs.readFileSync(keypairFile, "utf-8"));
    return Keypair.fromSecretKey(new Uint8Array(keypairData));
  }

  // Otherwise, generate a new keypair and save it
  const keypair = Keypair.generate();
  fs.writeFileSync(
    keypairFile,
    JSON.stringify(Array.from(keypair.secretKey)),
    "utf-8"
  );

  return keypair;
}
