import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as anchor from '@coral-xyz/anchor';

// Ensure Anchor provider URL and wallet are set for tests
process.env.ANCHOR_PROVIDER_URL = process.env.ANCHOR_PROVIDER_URL || 'http://localhost:8899';
process.env.ANCHOR_WALLET = process.env.ANCHOR_WALLET || path.join(os.homedir(), '.config', 'solana', 'id.json');

// Configure Anchor provider
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

// Load program IDL and register in workspace
const idlPath = path.join(process.cwd(), 'target', 'idl', 'mica_eur.json');
if (!fs.existsSync(idlPath)) {
  throw new Error(`IDL file not found at ${idlPath}`);
}
const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8')) as anchor.Idl;

// Instantiate the program using the IDL and provider (uses metadata.address from IDL)
const program = new anchor.Program(idl, provider);

// Monkey-patch anchor.workspace for tests
// Define a type for the workspace with our program
interface MicaWorkspace {
  MicaEur: anchor.Program;
}

// Cast the workspace to our specific type
(anchor.workspace as MicaWorkspace).MicaEur = program;

export {}; 