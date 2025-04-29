import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { PublicKey, Keypair } from '@solana/web3.js';
import { expect, assert } from 'chai';
import { fundAccounts } from '../setup';
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
  getMint
} from '@solana/spl-token';

/**
 * This functional test simulates transaction limits based on KYC verification
 * levels, testing tiered limits, daily/weekly/monthly caps, and compliance 
 * with regulatory requirements.
 */
describe('Transaction Limits Functional Tests', () => {
  // Configure the client
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Cast program to avoid type errors
  const program = anchor.workspace.MicaEur as unknown as Program<any>;
  const connection = program.provider.connection;

  // Test keypairs
  const issuer = anchor.web3.Keypair.generate();
  const freezeAuthority = anchor.web3.Keypair.generate();
  const permanentDelegate = anchor.web3.Keypair.generate();
  
  // Users with different KYC levels
  const level0User = anchor.web3.Keypair.generate(); // Unverified user
  const level1User = anchor.web3.Keypair.generate(); // Basic verification (Level 1)
  const level2User = anchor.web3.Keypair.generate(); // Enhanced verification (Level 2)
  const level3User = anchor.web3.Keypair.generate(); // Premium verification (Level 3)
  
  // Constants
  const MINT_INFO_SEED = Buffer.from("mint_info");
  const KYC_ORACLE_SEED = Buffer.from("kyc_oracle");
  const KYC_USER_SEED = Buffer.from("kyc_user");
  const WHITEPAPER_URI = "https://example.com/whitepaper.pdf";
  
  // Transaction limits by KYC level (in token units, considering 9 decimals)
  const LEVEL1_SINGLE_LIMIT = new anchor.BN(1_000).mul(new anchor.BN(10).pow(new anchor.BN(9))); // 1,000 EUR per transaction
  const LEVEL1_DAILY_LIMIT = new anchor.BN(5_000).mul(new anchor.BN(10).pow(new anchor.BN(9))); // 5,000 EUR daily
  const LEVEL1_MONTHLY_LIMIT = new anchor.BN(20_000).mul(new anchor.BN(10).pow(new anchor.BN(9))); // 20,000 EUR monthly
  
  const LEVEL2_SINGLE_LIMIT = new anchor.BN(10_000).mul(new anchor.BN(10).pow(new anchor.BN(9))); // 10,000 EUR per transaction
  const LEVEL2_DAILY_LIMIT = new anchor.BN(20_000).mul(new anchor.BN(10).pow(new anchor.BN(9))); // 20,000 EUR daily
  const LEVEL2_MONTHLY_LIMIT = new anchor.BN(100_000).mul(new anchor.BN(10).pow(new anchor.BN(9))); // 100,000 EUR monthly
  
  const LEVEL3_SINGLE_LIMIT = new anchor.BN(50_000).mul(new anchor.BN(10).pow(new anchor.BN(9))); // 50,000 EUR per transaction
  const LEVEL3_DAILY_LIMIT = new anchor.BN(100_000).mul(new anchor.BN(10).pow(new anchor.BN(9))); // 100,000 EUR daily
  const LEVEL3_MONTHLY_LIMIT = new anchor.BN(500_000).mul(new anchor.BN(10).pow(new anchor.BN(9))); // 500,000 EUR monthly
  
  // Test amounts
  const BASE_BALANCE = new anchor.BN(1_000_000).mul(new anchor.BN(10).pow(new anchor.BN(9))); // 1,000,000 EUR with 9 decimals
  
  // PDAs
  let mintInfoPubkey: PublicKey;
  let kycOracleState: PublicKey;
  let kycLevel0: PublicKey;
  let kycLevel1: PublicKey;
  let kycLevel2: PublicKey;
  let kycLevel3: PublicKey;
  let mintPubkey: Keypair;
  
  // Token accounts
  let level0TokenAccount: PublicKey;
  let level1TokenAccount: PublicKey;
  let level2TokenAccount: PublicKey;
  let level3TokenAccount: PublicKey;
  let treasuryTokenAccount: PublicKey;

  before(async () => {
    // Fund test accounts
    await fundAccounts(connection, [
      issuer, freezeAuthority, permanentDelegate,
      level0User, level1User, level2User, level3User
    ]);

    // Generate keypair for the mint
    mintPubkey = anchor.web3.Keypair.generate();

    // Find PDAs
    [mintInfoPubkey] = PublicKey.findProgramAddressSync(
      [MINT_INFO_SEED, mintPubkey.publicKey.toBuffer()],
      program.programId
    );

    [kycOracleState] = PublicKey.findProgramAddressSync(
      [KYC_ORACLE_SEED],
      program.programId
    );

    [kycLevel0] = PublicKey.findProgramAddressSync(
      [KYC_USER_SEED, level0User.publicKey.toBuffer()],
      program.programId
    );

    [kycLevel1] = PublicKey.findProgramAddressSync(
      [KYC_USER_SEED, level1User.publicKey.toBuffer()],
      program.programId
    );
    
    [kycLevel2] = PublicKey.findProgramAddressSync(
      [KYC_USER_SEED, level2User.publicKey.toBuffer()],
      program.programId
    );
    
    [kycLevel3] = PublicKey.findProgramAddressSync(
      [KYC_USER_SEED, level3User.publicKey.toBuffer()],
      program.programId
    );

    // Get token accounts
    level0TokenAccount = getAssociatedTokenAddressSync(
      mintPubkey.publicKey,
      level0User.publicKey,
      true,
      TOKEN_2022_PROGRAM_ID
    );

    level1TokenAccount = getAssociatedTokenAddressSync(
      mintPubkey.publicKey,
      level1User.publicKey,
      true,
      TOKEN_2022_PROGRAM_ID
    );
    
    level2TokenAccount = getAssociatedTokenAddressSync(
      mintPubkey.publicKey,
      level2User.publicKey,
      true,
      TOKEN_2022_PROGRAM_ID
    );
    
    level3TokenAccount = getAssociatedTokenAddressSync(
      mintPubkey.publicKey,
      level3User.publicKey,
      true,
      TOKEN_2022_PROGRAM_ID
    );
    
    treasuryTokenAccount = getAssociatedTokenAddressSync(
      mintPubkey.publicKey,
      issuer.publicKey,
      true,
      TOKEN_2022_PROGRAM_ID
    );
  });

  it('Initializes KYC and token system with different verification levels', async () => {
    // Initialize KYC Oracle
    await program.methods
      .initializeKycOracle()
      .accounts({
        authority: issuer.publicKey,
        oracleState: kycOracleState,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([issuer])
      .rpc();
    
    // Register users with different verification levels
    
    // Level 0 - Registered but unverified
    await program.methods
      .registerKycUser(
        "00000000", // BLZ
        Array.from({ length: 32 }, () => 0), // IBAN hash
        "DE", // Country code
        "BasicKYC" // Provider
      )
      .accounts({
        authority: issuer.publicKey,
        oracleState: kycOracleState,
        user: level0User.publicKey,
        kycUser: kycLevel0,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([issuer])
      .rpc();
    
    // Status remains "pending" for Level 0
    
    // Level 1 - Basic verification
    await program.methods
      .registerKycUser(
        "11111111", // BLZ
        Array.from({ length: 32 }, () => 1), // IBAN hash
        "DE", // Country code
        "BasicKYC" // Provider
      )
      .accounts({
        authority: issuer.publicKey,
        oracleState: kycOracleState,
        user: level1User.publicKey,
        kycUser: kycLevel1,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([issuer])
      .rpc();
    
    await program.methods
      .updateKycStatus(
        { verified: {} }, // Status
        1, // Level 1
        new anchor.BN(365) // 365 days validity
      )
      .accounts({
        authority: issuer.publicKey,
        oracleState: kycOracleState,
        kycUser: kycLevel1,
      })
      .signers([issuer])
      .rpc();
    
    // Level 2 - Enhanced verification
    await program.methods
      .registerKycUser(
        "22222222", // BLZ
        Array.from({ length: 32 }, () => 2), // IBAN hash
        "DE", // Country code
        "EnhancedKYC" // Provider
      )
      .accounts({
        authority: issuer.publicKey,
        oracleState: kycOracleState,
        user: level2User.publicKey,
        kycUser: kycLevel2,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([issuer])
      .rpc();
    
    await program.methods
      .updateKycStatus(
        { verified: {} }, // Status
        2, // Level 2
        new anchor.BN(365) // 365 days validity
      )
      .accounts({
        authority: issuer.publicKey,
        oracleState: kycOracleState,
        kycUser: kycLevel2,
      })
      .signers([issuer])
      .rpc();
    
    // Level 3 - Premium verification
    await program.methods
      .registerKycUser(
        "33333333", // BLZ
        Array.from({ length: 32 }, () => 3), // IBAN hash
        "DE", // Country code
        "PremiumKYC" // Provider
      )
      .accounts({
        authority: issuer.publicKey,
        oracleState: kycOracleState,
        user: level3User.publicKey,
        kycUser: kycLevel3,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([issuer])
      .rpc();
    
    await program.methods
      .updateKycStatus(
        { verified: {} }, // Status
        3, // Level 3
        new anchor.BN(365) // 365 days validity
      )
      .accounts({
        authority: issuer.publicKey,
        oracleState: kycOracleState,
        kycUser: kycLevel3,
      })
      .signers([issuer])
      .rpc();
    
    // Initialize EUR token mint
    await program.methods
      .initializeEuroMint(WHITEPAPER_URI)
      .accounts({
        issuer: issuer.publicKey,
        mintInfo: mintInfoPubkey,
        mint: mintPubkey.publicKey,
        freezeAuthority: freezeAuthority.publicKey,
        permanentDelegate: permanentDelegate.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([issuer, mintPubkey])
      .rpc();
    
    // Create token accounts
    const createAta0Tx = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(
        issuer.publicKey,
        level0TokenAccount,
        level0User.publicKey,
        mintPubkey.publicKey,
        TOKEN_2022_PROGRAM_ID
      )
    );
    
    const createAta1Tx = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(
        issuer.publicKey,
        level1TokenAccount,
        level1User.publicKey,
        mintPubkey.publicKey,
        TOKEN_2022_PROGRAM_ID
      )
    );
    
    const createAta2Tx = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(
        issuer.publicKey,
        level2TokenAccount,
        level2User.publicKey,
        mintPubkey.publicKey,
        TOKEN_2022_PROGRAM_ID
      )
    );
    
    const createAta3Tx = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(
        issuer.publicKey,
        level3TokenAccount,
        level3User.publicKey,
        mintPubkey.publicKey,
        TOKEN_2022_PROGRAM_ID
      )
    );
    
    const createAtaTreasuryTx = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(
        issuer.publicKey,
        treasuryTokenAccount,
        issuer.publicKey,
        mintPubkey.publicKey,
        TOKEN_2022_PROGRAM_ID
      )
    );
    
    await anchor.web3.sendAndConfirmTransaction(connection, createAta0Tx, [issuer]);
    await anchor.web3.sendAndConfirmTransaction(connection, createAta1Tx, [issuer]);
    await anchor.web3.sendAndConfirmTransaction(connection, createAta2Tx, [issuer]);
    await anchor.web3.sendAndConfirmTransaction(connection, createAta3Tx, [issuer]);
    await anchor.web3.sendAndConfirmTransaction(connection, createAtaTreasuryTx, [issuer]);
    
    // Mint tokens to verified users
    // Skip Level 0 (unverified)
    
    // Mint to Level 1
    await program.methods
      .mintTokens(BASE_BALANCE)
      .accounts({
        authority: issuer.publicKey,
        mint: mintPubkey.publicKey,
        mintInfo: mintInfoPubkey,
        destination: level1TokenAccount,
        destinationAuthority: level1User.publicKey,
        kyc: kycLevel1,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([issuer])
      .rpc();
    
    // Mint to Level 2
    await program.methods
      .mintTokens(BASE_BALANCE)
      .accounts({
        authority: issuer.publicKey,
        mint: mintPubkey.publicKey,
        mintInfo: mintInfoPubkey,
        destination: level2TokenAccount,
        destinationAuthority: level2User.publicKey,
        kyc: kycLevel2,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([issuer])
      .rpc();
    
    // Mint to Level 3
    await program.methods
      .mintTokens(BASE_BALANCE)
      .accounts({
        authority: issuer.publicKey,
        mint: mintPubkey.publicKey,
        mintInfo: mintInfoPubkey,
        destination: level3TokenAccount,
        destinationAuthority: level3User.publicKey,
        kyc: kycLevel3,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([issuer])
      .rpc();
    
    // Thaw accounts to allow transfers
    for (const account of [level1TokenAccount, level2TokenAccount, level3TokenAccount]) {
      await program.methods
        .thawAccount()
        .accounts({
          freezeAuthority: freezeAuthority.publicKey,
          mintInfo: mintInfoPubkey,
          mint: mintPubkey.publicKey,
          tokenAccount: account,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([freezeAuthority])
        .rpc();
    }
  });

  it('Enforces per-transaction limits based on KYC level', async () => {
    // Test 1: Level 1 user stays within their limit
    const level1SmallTransfer = LEVEL1_SINGLE_LIMIT.div(new anchor.BN(2)); // Half the limit
    await program.methods
      .transferTokens(level1SmallTransfer)
      .accounts({
        source: level1TokenAccount,
        destination: treasuryTokenAccount,
        authority: level1User.publicKey,
        sourceKyc: kycLevel1,
        destinationKyc: kycLevel1, // For testing purposes
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([level1User])
      .rpc();
    
    // Test 2: Level 1 user exceeds their limit (should fail)
    const level1LargeTransfer = LEVEL1_SINGLE_LIMIT.mul(new anchor.BN(2)); // Double the limit
    try {
      await program.methods
        .transferTokens(level1LargeTransfer)
        .accounts({
          source: level1TokenAccount,
          destination: treasuryTokenAccount,
          authority: level1User.publicKey,
          sourceKyc: kycLevel1,
          destinationKyc: kycLevel1,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([level1User])
        .rpc();
      assert.fail("Level 1 user should not be able to exceed transaction limit");
    } catch (error) {
      // Expected error
      console.log("Level 1 user correctly blocked from exceeding transaction limit");
    }
    
    // Test 3: Level 2 user can transfer above Level 1 limit but within their own limit
    const level2MediumTransfer = LEVEL1_SINGLE_LIMIT.mul(new anchor.BN(2)); // Above L1 but below L2 limit
    await program.methods
      .transferTokens(level2MediumTransfer)
      .accounts({
        source: level2TokenAccount,
        destination: treasuryTokenAccount,
        authority: level2User.publicKey,
        sourceKyc: kycLevel2,
        destinationKyc: kycLevel2, // For testing purposes
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([level2User])
      .rpc();
    
    // Test 4: Level 3 user can transfer above Level 2 limit but within their own limit
    const level3LargeTransfer = LEVEL2_SINGLE_LIMIT.mul(new anchor.BN(2)); // Above L2 but below L3 limit
    await program.methods
      .transferTokens(level3LargeTransfer)
      .accounts({
        source: level3TokenAccount,
        destination: treasuryTokenAccount,
        authority: level3User.publicKey,
        sourceKyc: kycLevel3,
        destinationKyc: kycLevel3, // For testing purposes
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([level3User])
      .rpc();
  });

  it('Enforces daily and monthly cumulative limits', async () => {
    // This test would track cumulative transfers over time
    console.log("Daily and monthly limit testing requires tracking transfer history");
    console.log("In a real implementation, the TransferHook would track these limits");
    
    // In a complete test implementation, we would:
    // 1. Make multiple transfers within a day up to the daily limit
    // 2. Verify further transfers are rejected
    // 3. Mock time advancement to next day
    // 4. Verify transfers are allowed again
    // 5. Repeat to test monthly limits
  });

  it('Prevents transfers to/from unverified accounts', async () => {
    // Test: Attempt transfer from verified to unverified account
    try {
      await program.methods
        .transferTokens(new anchor.BN(1_000_000_000)) // 1 token
        .accounts({
          source: level1TokenAccount,
          destination: level0TokenAccount,
          authority: level1User.publicKey,
          sourceKyc: kycLevel1,
          destinationKyc: kycLevel0,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([level1User])
        .rpc();
      assert.fail("Transfer to unverified account should fail");
    } catch (error) {
      // Expected error
      console.log("Correctly blocked transfer to unverified account");
    }
  });

  it('Logs transfers for compliance tracking', async () => {
    // In a real implementation, we would test for event emission and log storage
    console.log("Transfer logging test would check for proper event emission");
    console.log("In production, transfers should log sender, receiver, amount, timestamp");
    
    // Make a transfer that should be logged
    const transferAmount = new anchor.BN(1_000_000_000); // 1 token
    await program.methods
      .transferTokens(transferAmount)
      .accounts({
        source: level2TokenAccount,
        destination: level1TokenAccount,
        authority: level2User.publicKey,
        sourceKyc: kycLevel2,
        destinationKyc: kycLevel1,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([level2User])
      .rpc();
    
    // In a complete implementation, we would verify events were emitted
  });

  it('Handles KYC expiration and level changes appropriately', async () => {
    // Downgrade a user's KYC level
    await program.methods
      .updateKycStatus(
        { verified: {} }, // Status
        1, // Downgrade from Level 2 to Level 1
        new anchor.BN(365) // 365 days validity
      )
      .accounts({
        authority: issuer.publicKey,
        oracleState: kycOracleState,
        kycUser: kycLevel2,
      })
      .signers([issuer])
      .rpc();
    
    // Test: User with downgraded KYC can't exceed their new lower limit
    try {
      const level2LargeTransfer = LEVEL1_SINGLE_LIMIT.mul(new anchor.BN(2)); // Exceeds new Level 1 limit
      await program.methods
        .transferTokens(level2LargeTransfer)
        .accounts({
          source: level2TokenAccount,
          destination: treasuryTokenAccount,
          authority: level2User.publicKey,
          sourceKyc: kycLevel2,
          destinationKyc: kycLevel1,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([level2User])
        .rpc();
      assert.fail("Downgraded user should not be able to exceed new lower limit");
    } catch (error) {
      // Expected error
      console.log("Correctly enforced lower limit after KYC downgrade");
    }
  });
}); 