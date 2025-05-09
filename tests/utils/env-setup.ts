import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

// Check if we're running in mock mode (used for smoke tests)
const isMockMode = process.env.MOCK_TEST_MODE === "true";

if (!isMockMode) {
  // Ensure Anchor provider URL and wallet are set for tests
  process.env.ANCHOR_PROVIDER_URL =
    process.env.ANCHOR_PROVIDER_URL || "http://localhost:8899";
  process.env.ANCHOR_WALLET =
    process.env.ANCHOR_WALLET ||
    path.join(os.homedir(), ".config", "solana", "id.json");

  // Configure Anchor provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Load program IDL and register in workspace
  const idlPath = path.join(process.cwd(), "target", "idl", "mica_eur.json");
  if (!fs.existsSync(idlPath)) {
    throw new Error(`IDL file not found at ${idlPath}`);
  }

  // Parse the IDL file
  const rawIdl = JSON.parse(fs.readFileSync(idlPath, "utf8"));
  const idl = rawIdl as anchor.Idl;

  // Get program ID from IDL metadata or PROGRAM_ID environment variable
  let programId: PublicKey;
  if (rawIdl.metadata && rawIdl.metadata.address) {
    programId = new PublicKey(rawIdl.metadata.address);
    console.log(`Using program ID from IDL metadata: ${programId.toString()}`);
  } else if (process.env.PROGRAM_ID) {
    programId = new PublicKey(process.env.PROGRAM_ID);
    console.log(
      `Using program ID from environment variable: ${programId.toString()}`
    );
  } else {
    // Fallback to a default ID (this would be replaced in a production environment)
    programId = new PublicKey("MicaEUrZV5ukPdyVLkRRNr5z95sJzXDvRrxtJ3qTMDP");
    console.log(`Using fallback program ID: ${programId.toString()}`);
  }

  // Set the program ID in the IDL
  idl.address = programId.toString();

  // Instantiate the program
  const program = new anchor.Program(idl, provider);

  // Monkey-patch anchor.workspace for tests
  // Define a type for the workspace with our program
  interface MicaWorkspace {
    MicaEur: anchor.Program;
  }

  // Cast the workspace to our specific type
  (anchor.workspace as MicaWorkspace).MicaEur = program;
}

export {};
