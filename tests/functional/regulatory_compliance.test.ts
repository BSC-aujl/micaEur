import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { MicaEur } from '../../target/types/mica_eur';
import {
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  getAccount,
  AccountState,
} from '@solana/spl-token';
import { assert } from 'chai';
import { findProgramAddresses, fundAccounts } from '../setup';

/**
 * This functional test simulates a complete regulatory compliance
 * workflow including KYC verification, suspicious account handling,
 * freezing and seizure of assets, and MiCA compliance checks.
 */
describe('Regulatory Compliance Functional Tests', () => {
  // Configure the client
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Cast program to avoid type errors
  const program = anchor.workspace.MicaEur as unknown as Program<any>;
  const connection = program.provider.connection;

  // Role-specific keypairs
  const issuer = anchor.web3.Keypair.generate();
  const freezeAuthority = anchor.web3.Keypair.generate();
  const permanentDelegate = anchor.web3.Keypair.generate();
  const regulatoryAuthority = anchor.web3.Keypair.generate();
  const treasuryManager = anchor.web3.Keypair.generate();
  
  // User keypairs with different risk profiles
  const compliantUser = anchor.web3.Keypair.generate(); // Fully compliant user (DE, Level 2)
  const highRiskUser = anchor.web3.Keypair.generate(); // High-risk user (BG, Level 1)
  const sanctionedUser = anchor.web3.Keypair.generate(); // Suspicious user to be sanctioned (Verified -> Revoked)
  
  // Constants
  const MINT_INFO_SEED = Buffer.from("mint_info");
  const KYC_ORACLE_SEED = Buffer.from("kyc_oracle");
  const KYC_USER_SEED = Buffer.from("kyc_user");
  const RESERVE_ACCOUNT_SEED = Buffer.from("reserve_account");
  const METADATA_URL = "https://example.com/metadata.json";
  const WHITEPAPER_URL = "https://example.com/whitepaper.pdf";
  const TOKEN_DECIMALS = 9;
  
  // Test amounts
  const TEST_AMOUNT = 10_000_000_000_000; // 10,000 tokens with 9 decimals
  
  // PDAs
  let mintInfoPubkey: PublicKey;
  let kycOracleState: PublicKey;
  let kycCompliantUser: PublicKey;
  let kycHighRiskUser: PublicKey;
  let kycSanctionedUser: PublicKey;
  let reserveAccount: PublicKey;
  let euroMint: Keypair;
  
  // Token accounts
  let compliantUserTokenAccount: PublicKey;
  let highRiskUserTokenAccount: PublicKey;
  let sanctionedUserTokenAccount: PublicKey;
  let treasuryTokenAccount: PublicKey;

  before(async () => {
    // Fund test accounts
    await fundAccounts(connection, [
      issuer, freezeAuthority, permanentDelegate, regulatoryAuthority, treasuryManager,
      compliantUser, highRiskUser, sanctionedUser
    ]);

    // Generate keypair for the token mint
    euroMint = anchor.web3.Keypair.generate();

    // Find PDAs
    [mintInfoPubkey] = PublicKey.findProgramAddressSync(
      [MINT_INFO_SEED, euroMint.publicKey.toBuffer()],
      program.programId
    );

    [kycOracleState] = PublicKey.findProgramAddressSync(
      [KYC_ORACLE_SEED],
      program.programId
    );

    [kycCompliantUser] = PublicKey.findProgramAddressSync(
      [KYC_USER_SEED, compliantUser.publicKey.toBuffer()],
      program.programId
    );

    [kycHighRiskUser] = PublicKey.findProgramAddressSync(
      [KYC_USER_SEED, highRiskUser.publicKey.toBuffer()],
      program.programId
    );
    
    [kycSanctionedUser] = PublicKey.findProgramAddressSync(
      [KYC_USER_SEED, sanctionedUser.publicKey.toBuffer()],
      program.programId
    );
    
    [reserveAccount] = PublicKey.findProgramAddressSync(
      [RESERVE_ACCOUNT_SEED],
      program.programId
    );

    // Get token accounts
    compliantUserTokenAccount = getAssociatedTokenAddressSync(
      euroMint.publicKey,
      compliantUser.publicKey,
      true,
      TOKEN_2022_PROGRAM_ID
    );

    highRiskUserTokenAccount = getAssociatedTokenAddressSync(
      euroMint.publicKey,
      highRiskUser.publicKey,
      true,
      TOKEN_2022_PROGRAM_ID
    );
    
    sanctionedUserTokenAccount = getAssociatedTokenAddressSync(
      euroMint.publicKey,
      sanctionedUser.publicKey,
      true,
      TOKEN_2022_PROGRAM_ID
    );
    
    treasuryTokenAccount = getAssociatedTokenAddressSync(
      euroMint.publicKey,
      treasuryManager.publicKey,
      true,
      TOKEN_2022_PROGRAM_ID
    );
  });

  it('Initializes the regulatory compliance environment', async () => {
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
      
    // Register KYC for compliant user (German, Level 2)
    await program.methods
      .registerKycUser(
        "12345678", // BLZ
        Array.from({ length: 32 }, (_, i) => i), // IBAN hash
        "DE", // German country code
        "PremiumKYC" // Provider
      )
      .accounts({
        authority: issuer.publicKey,
        oracleState: kycOracleState,
        user: compliantUser.publicKey,
        kycUser: kycCompliantUser,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([issuer])
      .rpc();
    
    // Verify compliant user with high verification level
    await program.methods
      .updateKycStatus(
        { verified: {} },
        2, // Level 2 - high verification
        new anchor.BN(365) // 365 days validity
      )
      .accounts({
        authority: issuer.publicKey,
        oracleState: kycOracleState,
        kycUser: kycCompliantUser,
      })
      .signers([issuer])
      .rpc();
      
    // Register KYC for high-risk user (Bulgarian, Level 1)
    await program.methods
      .registerKycUser(
        "87654321", // BLZ
        Array.from({ length: 32 }, (_, i) => 32 - i), // IBAN hash
        "BG", // Bulgarian country code (higher risk)
        "BasicKYC" // Provider
      )
      .accounts({
        authority: issuer.publicKey,
        oracleState: kycOracleState,
        user: highRiskUser.publicKey,
        kycUser: kycHighRiskUser,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([issuer])
      .rpc();
    
    // Verify high-risk user with basic verification level
    await program.methods
      .updateKycStatus(
        { verified: {} },
        1, // Level 1 - basic verification
        new anchor.BN(180) // 180 days validity (shorter period due to risk)
      )
      .accounts({
        authority: issuer.publicKey,
        oracleState: kycOracleState,
        kycUser: kycHighRiskUser,
      })
      .signers([issuer])
      .rpc();
      
    // Register KYC for sanctioned user (Initially verified but will be revoked)
    await program.methods
      .registerKycUser(
        "11223344", // BLZ
        Array.from({ length: 32 }, (_, i) => i % 2), // IBAN hash
        "ES", // Spanish country code
        "BasicKYC" // Provider
      )
      .accounts({
        authority: issuer.publicKey,
        oracleState: kycOracleState,
        user: sanctionedUser.publicKey,
        kycUser: kycSanctionedUser,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([issuer])
      .rpc();
    
    // Verify sanctioned user (will be revoked later in tests)
    await program.methods
      .updateKycStatus(
        { verified: {} },
        1, // Level 1
        new anchor.BN(30) // 30 days validity (shorter period for later revocation test)
      )
      .accounts({
        authority: issuer.publicKey,
        oracleState: kycOracleState,
        kycUser: kycSanctionedUser,
      })
      .signers([issuer])
      .rpc();
    
    // Initialize EUR token
    await program.methods
      .initializeEuroMint(
        METADATA_URL,
        WHITEPAPER_URL,
        TOKEN_DECIMALS,
      )
      .accounts({
        issuer: issuer.publicKey,
        mintInfo: mintInfoPubkey,
        mint: euroMint.publicKey,
        freezeAuthority: freezeAuthority.publicKey,
        permanentDelegate: permanentDelegate.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([issuer, euroMint])
      .rpc();
    
    // Create token accounts
    const createAta1Tx = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(
        issuer.publicKey,
        compliantUserTokenAccount,
        compliantUser.publicKey,
        euroMint.publicKey,
        TOKEN_2022_PROGRAM_ID
      )
    );
    
    const createAta2Tx = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(
        issuer.publicKey,
        highRiskUserTokenAccount,
        highRiskUser.publicKey,
        euroMint.publicKey,
        TOKEN_2022_PROGRAM_ID
      )
    );
    
    const createAta3Tx = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(
        issuer.publicKey,
        sanctionedUserTokenAccount,
        sanctionedUser.publicKey,
        euroMint.publicKey,
        TOKEN_2022_PROGRAM_ID
      )
    );
    
    const createAtaTreasuryTx = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(
        issuer.publicKey,
        treasuryTokenAccount,
        treasuryManager.publicKey,
        euroMint.publicKey,
        TOKEN_2022_PROGRAM_ID
      )
    );
    
    await anchor.web3.sendAndConfirmTransaction(connection, createAta1Tx, [issuer]);
    await anchor.web3.sendAndConfirmTransaction(connection, createAta2Tx, [issuer]);
    await anchor.web3.sendAndConfirmTransaction(connection, createAta3Tx, [issuer]);
    await anchor.web3.sendAndConfirmTransaction(connection, createAtaTreasuryTx, [issuer]);
    
    // All initializations succeeded
    assert.isDefined(kycOracleState, "KYC Oracle state PDA should be defined");
    assert.isDefined(mintInfoPubkey, "Mint info PDA should be defined");
    assert.isDefined(euroMint.publicKey, "EUR mint should be defined");
  });

  it('Applies risk-based approach to transaction limits', async () => {
    // Mint tokens to compliant user
    await program.methods
      .mintTokens(new anchor.BN(TEST_AMOUNT))
      .accounts({
        authority: issuer.publicKey,
        euroMint: euroMint.publicKey,
        mintInfo: mintInfoPubkey,
        destination: compliantUserTokenAccount,
        destinationAuthority: compliantUser.publicKey,
        kyc: kycCompliantUser,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([issuer])
      .rpc();
    
    // Mint tokens to high-risk user (smaller amount due to risk profile)
    const highRiskAmount = TEST_AMOUNT / 10; // 10x lower than compliant user
    await program.methods
      .mintTokens(new anchor.BN(highRiskAmount))
      .accounts({
        authority: issuer.publicKey,
        euroMint: euroMint.publicKey,
        mintInfo: mintInfoPubkey,
        destination: highRiskUserTokenAccount,
        destinationAuthority: highRiskUser.publicKey,
        kyc: kycHighRiskUser,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([issuer])
      .rpc();
    
    // Mint tokens to sanctioned user (very small amount that will be seized later)
    const sanctionedAmount = TEST_AMOUNT / 20; // Very limited amount
    await program.methods
      .mintTokens(new anchor.BN(sanctionedAmount))
      .accounts({
        authority: issuer.publicKey,
        euroMint: euroMint.publicKey,
        mintInfo: mintInfoPubkey,
        destination: sanctionedUserTokenAccount,
        destinationAuthority: sanctionedUser.publicKey,
        kyc: kycSanctionedUser,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([issuer])
      .rpc();
    
    // Verify token balances reflect the risk-based approach
    const compliantAccount = await getAccount(connection, compliantUserTokenAccount, undefined, TOKEN_2022_PROGRAM_ID);
    const highRiskAccount = await getAccount(connection, highRiskUserTokenAccount, undefined, TOKEN_2022_PROGRAM_ID);
    const sanctionedAccount = await getAccount(connection, sanctionedUserTokenAccount, undefined, TOKEN_2022_PROGRAM_ID);
    
    assert.equal(compliantAccount.amount.toString(), TEST_AMOUNT.toString(), "Compliant user should have full amount");
    assert.equal(highRiskAccount.amount.toString(), highRiskAmount.toString(), "High-risk user should have reduced amount");
    assert.equal(sanctionedAccount.amount.toString(), sanctionedAmount.toString(), "Sanctioned user should have minimal amount");
  });

  it('Enforces transaction limits based on KYC level', async () => {
    // Thaw accounts to allow transfers
    await program.methods
      .thawAccount()
      .accounts({
        freezeAuthority: freezeAuthority.publicKey,
        mintInfo: mintInfoPubkey,
        mint: euroMint.publicKey,
        tokenAccount: compliantUserTokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([freezeAuthority])
      .rpc();

    await program.methods
      .thawAccount()
      .accounts({
        freezeAuthority: freezeAuthority.publicKey,
        mintInfo: mintInfoPubkey,
        mint: euroMint.publicKey,
        tokenAccount: highRiskUserTokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([freezeAuthority])
      .rpc();
    
    // Test 1: Valid transfer within limits
    const transferAmount = TEST_AMOUNT / 100; // Small amount
    await program.methods
      .transferTokens(new anchor.BN(transferAmount))
      .accounts({
        source: compliantUserTokenAccount,
        destination: highRiskUserTokenAccount,
        authority: compliantUser.publicKey,
        sourceKyc: kycCompliantUser,
        destinationKyc: kycHighRiskUser,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([compliantUser])
      .rpc();
    
    // Test 2: Attempt to exceed transaction limit for high-risk user
    const largeTransferAmount = TEST_AMOUNT / 2; // Exceeds Level 1 limit
    try {
      await program.methods
        .transferTokens(new anchor.BN(largeTransferAmount))
        .accounts({
          source: highRiskUserTokenAccount,
          destination: compliantUserTokenAccount,
          authority: highRiskUser.publicKey,
          sourceKyc: kycHighRiskUser,
          destinationKyc: kycCompliantUser,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([highRiskUser])
        .rpc();
      assert.fail("Should not be able to exceed transaction limit");
    } catch (error) {
      // Expected error due to transaction limit
      assert.include(error.message, "Transaction limit exceeded");
    }
  });

  it('Handles sanctioned users appropriately', async () => {
    // Revoke KYC verification for sanctioned user
    await program.methods
      .updateKycStatus(
        { revoked: {} }, // Revoked status
        0, // Level 0
        new anchor.BN(0) // 0 days validity
      )
      .accounts({
        authority: issuer.publicKey,
        oracleState: kycOracleState,
        kycUser: kycSanctionedUser,
      })
      .signers([issuer])
      .rpc();
    
    // Freeze sanctioned user's account
    await program.methods
      .freezeAccount()
      .accounts({
        freezeAuthority: freezeAuthority.publicKey,
        mintInfo: mintInfoPubkey,
        mint: euroMint.publicKey,
        tokenAccount: sanctionedUserTokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([freezeAuthority])
      .rpc();
    
    // Verify account is frozen
    const sanctionedAccountAfterFreeze = await getAccount(
      connection, 
      sanctionedUserTokenAccount,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    
    // TODO: Check for frozen state when implemented
    
    // Test: Attempt to transfer from sanctioned account (should fail)
    try {
      await program.methods
        .transferTokens(new anchor.BN(TEST_AMOUNT / 100))
        .accounts({
          source: sanctionedUserTokenAccount,
          destination: compliantUserTokenAccount,
          authority: sanctionedUser.publicKey,
          sourceKyc: kycSanctionedUser,
          destinationKyc: kycCompliantUser,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([sanctionedUser])
        .rpc();
      assert.fail("Should not be able to transfer from frozen/sanctioned account");
    } catch (error) {
      // Expected error due to frozen account or revoked KYC
      assert.include(error.message, "Account is frozen");
    }
  });

  it('Executes court-ordered seizure of tokens', async () => {
    // Seize tokens from sanctioned user to treasury
    const seizeAmount = TEST_AMOUNT / 20; // Full balance of sanctioned user
    await program.methods
      .seizeTokens(new anchor.BN(seizeAmount))
      .accounts({
        authority: permanentDelegate.publicKey,
        source: sanctionedUserTokenAccount,
        destination: treasuryTokenAccount,
        mint: euroMint.publicKey,
        mintInfo: mintInfoPubkey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        courtOrderId: "CO-2023-XYZ-12345", // Court order reference
        caseNumber: "CASE-2023-789",
      })
      .signers([permanentDelegate])
      .rpc();
    
    // Verify tokens were seized
    const sanctionedAccountAfterSeizure = await getAccount(
      connection, 
      sanctionedUserTokenAccount,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    
    const treasuryAccountAfterSeizure = await getAccount(
      connection, 
      treasuryTokenAccount,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    
    assert.equal(sanctionedAccountAfterSeizure.amount.toString(), "0", "Sanctioned account should be empty");
    assert.equal(treasuryAccountAfterSeizure.amount.toString(), seizeAmount.toString(), "Treasury should have seized funds");
  });

  it('Maintains reserve proofs for regulatory compliance', async () => {
    // Update reserve proof to demonstrate 1:1 backing
    const reserveAmount = TEST_AMOUNT + (TEST_AMOUNT / 10) + (TEST_AMOUNT / 20);
    const reserveProofUrl = "https://example.com/reserve-proof/2023/q2.pdf";
    
    await program.methods
      .updateReserveProof(
        new anchor.BN(reserveAmount),
        reserveProofUrl
      )
      .accounts({
        authority: issuer.publicKey,
        reserveAccount: reserveAccount,
      })
      .signers([issuer])
      .rpc();
      
    // Verify reserve proof was updated
    const reserveInfo = await program.account.reserveAccount.fetch(reserveAccount);
    assert.equal(reserveInfo.reserveAmount.toString(), reserveAmount.toString(),
               "Reserve amount should match");
    assert.equal(reserveInfo.reserveProofUrl, reserveProofUrl,
               "Reserve proof URL should match");
  });
}); 