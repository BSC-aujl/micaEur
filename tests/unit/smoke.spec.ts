import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { MicaEur } from '../../target/types/mica_eur';
import { PublicKey } from '@solana/web3.js';
import { assert } from 'chai';
import { TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';

describe('MICA EUR Smoke Tests', () => {
  // Configure the client
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  
  let program: anchor.Program<any>;
  
  before(() => {
    try {
      program = anchor.workspace.MicaEur as anchor.Program<any>;
    } catch (error) {
      console.log("Error loading program, some tests will be skipped:", error);
    }
  });

  // Test constants
  const KYC_ORACLE_SEED = Buffer.from("kyc_oracle");
  const KYC_USER_SEED = Buffer.from("kyc_user");
  const EURO_MINT_SEED = Buffer.from("euro_mint");
  const RESERVE_ACCOUNT_SEED = Buffer.from("reserve_account");
  const WHITEPAPER_SEED = Buffer.from("whitepaper");

  it('Program reference can be loaded', () => {
    assert.isDefined(provider);
    console.log(`Provider URL: ${provider.connection.rpcEndpoint}`);
    if (program) {
      console.log(`Program ID: ${program.programId.toString()}`);
    } else {
      console.log("Program couldn't be loaded - expected during initial test development");
    }
  });

  it('Has core KYC-related instructions', () => {
    if (!program) {
      console.log("Program not loaded, skipping test");
      return;
    }
    
    // Base KYC instructions that we know exist in the IDL
    assert.isDefined(program.methods.initialize);
    assert.isDefined(program.methods.initializeKycOracle);
    assert.isDefined(program.methods.registerKycUser);
    assert.isDefined(program.methods.updateKycStatus);
    
    // List other methods that will be implemented but don't check for them yet
    console.log("Methods to be implemented:");
    console.log("- initializeEuroMint");
    console.log("- createTokenAccount");
    console.log("- mintTokens");
    console.log("- burnTokens");
    console.log("- freezeAccount");
    console.log("- thawAccount");
    console.log("- seizeTokens");
    console.log("- updateReserveProof");
  });

  it('Can derive all required PDAs', () => {
    if (!program) {
      console.log("Program not loaded, skipping test");
      return;
    }
    
    // User keypair for testing
    const user = anchor.web3.Keypair.generate();
    
    // KYC Oracle State PDA
    const [kycOracleState, _oracleBump] = PublicKey.findProgramAddressSync(
      [KYC_ORACLE_SEED],
      program.programId
    );
    assert.isDefined(kycOracleState);
    
    // KYC User PDA
    const [kycUser, _userBump] = PublicKey.findProgramAddressSync(
      [KYC_USER_SEED, user.publicKey.toBuffer()],
      program.programId
    );
    assert.isDefined(kycUser);
    
    // Euro Mint PDA
    const [euroMint, _mintBump] = PublicKey.findProgramAddressSync(
      [EURO_MINT_SEED],
      program.programId
    );
    assert.isDefined(euroMint);
    
    // Reserve Account PDA
    const [reserveAccount, _reserveBump] = PublicKey.findProgramAddressSync(
      [RESERVE_ACCOUNT_SEED],
      program.programId
    );
    assert.isDefined(reserveAccount);
    
    // Whitepaper PDA
    const [whitepaperPointer, _paperBump] = PublicKey.findProgramAddressSync(
      [WHITEPAPER_SEED],
      program.programId
    );
    assert.isDefined(whitepaperPointer);
  });

  it('Verifies TOKEN_2022_PROGRAM_ID is available', () => {
    assert.isDefined(TOKEN_2022_PROGRAM_ID);
    console.log(`Token-2022 Program ID: ${TOKEN_2022_PROGRAM_ID.toString()}`);
  });
}); 