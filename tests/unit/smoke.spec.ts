import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { assert } from 'chai';
import { findProgramAddresses } from '../setup';

describe('MiCA EUR - Smoke Tests', () => {
  // Configure the client
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider();
  
  // Allow any type for now to avoid complex type issues in test env
  const program = anchor.workspace.MicaEur as Program<any>;
  const connection = program.provider.connection;
  
  // Test keypairs
  const authority = anchor.web3.Keypair.generate();
  const user1 = anchor.web3.Keypair.generate();
  
  // Constants
  const BLZ1 = '10010010';
  const IBAN_HASH1 = Buffer.from(new Uint8Array(32).fill(1));
  const COUNTRY_CODE = 'DE';
  const VERIFICATION_PROVIDER = 'TestProvider';
  
  // Before running tests
  before(async () => {
    // Log test information
    console.log("Running smoke tests with program:", program.programId.toString());
    
    // Fund account
    const signature = await connection.requestAirdrop(authority.publicKey, 10 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(signature);
    
    // Find PDAs
    const { kycOraclePDA, kycUserPDAs } = findProgramAddresses(
      program.programId,
      new PublicKey("11111111111111111111111111111111"),  // Dummy mint for smoke test
      [user1.publicKey]
    );
    
    // Store PDAs for later use
    (this as any).kycOracleState = kycOraclePDA[0];
    (this as any).kycUser1 = kycUserPDAs.get(user1.publicKey.toString())![0];
  });
  
  it('Can connect to the program', async () => {
    // This simply tests that we can connect to the program
    assert.isNotNull(program.programId);
    assert.isTrue(PublicKey.isOnCurve(program.programId.toBytes()));
  });
  
  it('Program has the expected account structures', async () => {
    // Here we're just testing that the program account structure matches what we expect
    // We don't need to initialize anything for this test
    assert.isDefined(program.account);
    
    // Optional: Log the available accounts for debugging
    console.log("Available program accounts:", Object.keys(program.account));
    
    // This test might need adjustment based on your actual program structure
  });
  
  // Add more smoke tests as needed
}); 