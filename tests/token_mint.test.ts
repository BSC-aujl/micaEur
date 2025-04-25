import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { MicaEur } from '../target/types/mica_eur';
import {
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
} from '@solana/web3.js';
import {
  ExtensionType,
  createInitializeMintInstruction,
  getMintLen,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMetadataPointerInstruction,
  getAccount,
  createAccount,
  createInitializeDefaultAccountStateInstruction,
  createTransferInstruction,
  createInitializeTransferHookInstruction,
  createInitializePermanentDelegateInstruction,
} from '@solana/spl-token';
import { assert } from 'chai';
import { findProgramAddresses, fundAccounts } from './setup';

describe('EUR Token Mint Tests', () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.MicaEur as Program<MicaEur>;
  const connection = program.provider.connection;

  // Test keypairs
  const authority = anchor.web3.Keypair.generate();
  const user1 = anchor.web3.Keypair.generate();
  const user2 = anchor.web3.Keypair.generate();
  const user3 = anchor.web3.Keypair.generate();
  const nonVerifiedUser = anchor.web3.Keypair.generate();

  // Test accounts
  let kycOracleState: PublicKey;
  let kycUser1: PublicKey;
  let kycUser2: PublicKey;
  let kycUser3: PublicKey;
  let euroMint: PublicKey;
  let reserveAccount: PublicKey;
  let whitepaperPointer: PublicKey;
  let user1TokenAccount: PublicKey;
  let user2TokenAccount: PublicKey;
  let user3TokenAccount: PublicKey;
  let nonVerifiedTokenAccount: PublicKey;

  // Seeds
  const KYC_ORACLE_SEED = Buffer.from("kyc_oracle");
  const KYC_USER_SEED = Buffer.from("kyc_user");
  const EURO_MINT_SEED = Buffer.from("euro_mint");
  const RESERVE_ACCOUNT_SEED = Buffer.from("reserve_account");
  const WHITEPAPER_SEED = Buffer.from("whitepaper");

  // Extension constants
  const TRANSFER_HOOK_PROGRAM_ID = program.programId; // Using our program as the transfer hook
  const METADATA_URL = "https://example.com/euro-token-metadata";
  const WHITEPAPER_URL = "https://example.com/euro-token-whitepaper";
  const TOKEN_DECIMALS = 6;
  const DEFAULT_ACCOUNT_STATE = 1; // Frozen by default
  
  before(async () => {
    // Fund test accounts
    await fundAccounts(connection, [
      authority,
      user1,
      user2,
      user3,
      nonVerifiedUser
    ]);

    // Find PDAs
    [kycOracleState] = anchor.web3.PublicKey.findProgramAddressSync(
      [KYC_ORACLE_SEED],
      program.programId
    );

    [kycUser1] = anchor.web3.PublicKey.findProgramAddressSync(
      [KYC_USER_SEED, user1.publicKey.toBuffer()],
      program.programId
    );

    [kycUser2] = anchor.web3.PublicKey.findProgramAddressSync(
      [KYC_USER_SEED, user2.publicKey.toBuffer()],
      program.programId
    );

    [kycUser3] = anchor.web3.PublicKey.findProgramAddressSync(
      [KYC_USER_SEED, user3.publicKey.toBuffer()],
      program.programId
    );

    [euroMint] = anchor.web3.PublicKey.findProgramAddressSync(
      [EURO_MINT_SEED],
      program.programId
    );

    [reserveAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [RESERVE_ACCOUNT_SEED],
      program.programId
    );

    [whitepaperPointer] = anchor.web3.PublicKey.findProgramAddressSync(
      [WHITEPAPER_SEED],
      program.programId
    );

    // Initialize KYC Oracle
    await program.methods
      .initializeKycOracle()
      .accounts({
        authority: authority.publicKey,
        oracleState: kycOracleState,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    // Register and verify users
    const blz1 = '10070000';
    const ibanHash1 = Array.from(Buffer.from('IBAN1_HASH_PLACEHOLDER'.padEnd(32, '0')));
    
    await program.methods
      .registerKycUser(
        blz1,
        ibanHash1,
        'DE',
        'TEST_PROVIDER'
      )
      .accounts({
        authority: authority.publicKey,
        oracleState: kycOracleState,
        user: user1.publicKey,
        kycUser: kycUser1,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    // Verify user1 with level 2 (high verification)
    await program.methods
      .updateKycStatus(
        { verified: {} },
        2, // Level 2
        365 // 365 days validity
      )
      .accounts({
        authority: authority.publicKey,
        oracleState: kycOracleState,
        kycUser: kycUser1,
      })
      .signers([authority])
      .rpc();

    // Register and verify user2 with level 1 (medium verification)
    const blz2 = '37040044';
    const ibanHash2 = Array.from(Buffer.from('IBAN2_HASH_PLACEHOLDER'.padEnd(32, '0')));
    
    await program.methods
      .registerKycUser(
        blz2,
        ibanHash2,
        'DE',
        'TEST_PROVIDER'
      )
      .accounts({
        authority: authority.publicKey,
        oracleState: kycOracleState,
        user: user2.publicKey,
        kycUser: kycUser2,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    await program.methods
      .updateKycStatus(
        { verified: {} },
        1, // Level 1
        365 // 365 days validity
      )
      .accounts({
        authority: authority.publicKey,
        oracleState: kycOracleState,
        kycUser: kycUser2,
      })
      .signers([authority])
      .rpc();

    // Register user3 but don't verify them yet
    const blz3 = '20050550';
    const ibanHash3 = Array.from(Buffer.from('IBAN3_HASH_PLACEHOLDER'.padEnd(32, '0')));
    
    await program.methods
      .registerKycUser(
        blz3,
        ibanHash3,
        'DE',
        'TEST_PROVIDER'
      )
      .accounts({
        authority: authority.publicKey,
        oracleState: kycOracleState,
        user: user3.publicKey,
        kycUser: kycUser3,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();
  });

  describe('Euro Token Mint Initialization', () => {
    it('Initializes the Euro token mint with all required extensions', async () => {
      // Calculate mint account size with extensions
      const extensions = [
        ExtensionType.DefaultAccountState,
        ExtensionType.TransferHook,
        ExtensionType.PermanentDelegate,
        ExtensionType.MetadataPointer
      ];
      
      const mintLen = getMintLen(extensions);
      
      // Initialize EUR token mint
      await program.methods
        .initializeEuroMint(
          METADATA_URL,
          WHITEPAPER_URL,
          TOKEN_DECIMALS,
          DEFAULT_ACCOUNT_STATE
        )
        .accounts({
          authority: authority.publicKey,
          kycOracleState: kycOracleState,
          euroMint: euroMint,
          reserveAccount: reserveAccount,
          whitepaperPointer: whitepaperPointer,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      // Verify the mint was initialized correctly
      const mintInfo = await connection.getAccountInfo(euroMint);
      assert.isNotNull(mintInfo, "Mint account should exist");
      assert.equal(mintInfo.owner.toString(), TOKEN_2022_PROGRAM_ID.toString(), "Mint should be owned by TOKEN_2022_PROGRAM_ID");
      
      // Now create token accounts for our test users
      // User1 token account (level 2 KYC)
      user1TokenAccount = await createAccount(
        connection,
        user1,
        euroMint,
        user1.publicKey,
        undefined,
        undefined,
        TOKEN_2022_PROGRAM_ID
      );
      
      // User2 token account (level 1 KYC)
      user2TokenAccount = await createAccount(
        connection,
        user2,
        euroMint,
        user2.publicKey,
        undefined,
        undefined,
        TOKEN_2022_PROGRAM_ID
      );
      
      // User3 token account (unverified)
      user3TokenAccount = await createAccount(
        connection,
        user3,
        euroMint,
        user3.publicKey,
        undefined,
        undefined,
        TOKEN_2022_PROGRAM_ID
      );
      
      // Non-verified user token account
      nonVerifiedTokenAccount = await createAccount(
        connection,
        nonVerifiedUser,
        euroMint,
        nonVerifiedUser.publicKey,
        undefined,
        undefined,
        TOKEN_2022_PROGRAM_ID
      );
    });

    it('Contains the DefaultAccountState extension', async () => {
      // Check that DefaultAccountState extension exists and is set correctly
      const result = await program.methods
        .checkDefaultAccountState()
        .accounts({
          euroMint: euroMint,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .view();
      
      assert.equal(result.accountState, DEFAULT_ACCOUNT_STATE, "Default account state should be frozen");
    });

    it('Contains the TransferHook extension', async () => {
      // Check that TransferHook extension exists and is set correctly
      const result = await program.methods
        .checkTransferHookProgramId()
        .accounts({
          euroMint: euroMint,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .view();
      
      assert.equal(result.programId.toString(), TRANSFER_HOOK_PROGRAM_ID.toString(), "Transfer hook program ID should match");
    });

    it('Contains the PermanentDelegate extension', async () => {
      // Check that PermanentDelegate extension exists and is set correctly
      const result = await program.methods
        .checkPermanentDelegate()
        .accounts({
          euroMint: euroMint,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .view();
      
      assert.equal(result.delegate.toString(), authority.publicKey.toString(), "Permanent delegate should be the authority");
    });

    it('Contains the MetadataPointer extension', async () => {
      // Check that MetadataPointer extension exists and is set correctly
      const result = await program.methods
        .checkMetadataPointer()
        .accounts({
          euroMint: euroMint,
          whitepaperPointer: whitepaperPointer,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .view();
      
      assert.equal(result.metadataUrl, METADATA_URL, "Metadata URL should match");
      assert.equal(result.whitepaperUrl, WHITEPAPER_URL, "Whitepaper URL should match");
    });
  });

  describe('Mint and Transfer Tests', () => {
    it('Allows the authority to mint tokens to verified users', async () => {
      // Mint tokens to user1 (verified, level 2)
      const mintAmount = 1000 * 10**TOKEN_DECIMALS; // 1000 EUR

      await program.methods
        .mintTokens(new anchor.BN(mintAmount))
        .accounts({
          authority: authority.publicKey,
          euroMint: euroMint,
          destination: user1TokenAccount,
          kycOracleState: kycOracleState,
          kycUser: kycUser1,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([authority])
        .rpc();

      // Check the tokens were minted
      const accountInfo = await getAccount(
        connection,
        user1TokenAccount,
        undefined,
        TOKEN_2022_PROGRAM_ID
      );
      
      assert.equal(accountInfo.amount.toString(), mintAmount.toString(), "Token amount should match mint amount");
    });

    it('Prevents minting tokens to unverified users', async () => {
      // Try to mint tokens to nonVerifiedUser (not KYC verified)
      const mintAmount = 1000 * 10**TOKEN_DECIMALS; // 1000 EUR

      try {
        await program.methods
          .mintTokens(new anchor.BN(mintAmount))
          .accounts({
            authority: authority.publicKey,
            euroMint: euroMint,
            destination: nonVerifiedTokenAccount,
            kycOracleState: kycOracleState,
            kycUser: PublicKey.default, // No KYC user
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([authority])
          .rpc();
        
        assert.fail('Should not be able to mint tokens to unverified users');
      } catch (error) {
        // Expected error
        assert.include(error.toString(), 'failed', 'Expected minting to unverified user to fail');
      }
    });

    it('Enforces transfer limits based on KYC level', async () => {
      // First mint some tokens to user2 (level 1 verification)
      const mintAmount = 100 * 10**TOKEN_DECIMALS; // 100 EUR
      
      await program.methods
        .mintTokens(new anchor.BN(mintAmount))
        .accounts({
          authority: authority.publicKey,
          euroMint: euroMint,
          destination: user2TokenAccount,
          kycOracleState: kycOracleState,
          kycUser: kycUser2,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([authority])
        .rpc();
        
      // Now test transfer limit for level 1 user
      // Level 1 users are limited to 1,000 EUR per transaction
      const validTransferAmount = 900 * 10**TOKEN_DECIMALS; // 900 EUR - should succeed
      
      await program.methods
        .transferTokens(new anchor.BN(validTransferAmount))
        .accounts({
          source: user1TokenAccount,
          destination: user2TokenAccount,
          authority: user1.publicKey,
          euroMint: euroMint,
          sourceKycUser: kycUser1,
          destinationKycUser: kycUser2,
          kycOracleState: kycOracleState,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([user1])
        .rpc();
        
      // Try to transfer more than the limit
      const excessiveTransferAmount = 1500 * 10**TOKEN_DECIMALS; // 1500 EUR - should fail
      
      try {
        await program.methods
          .transferTokens(new anchor.BN(excessiveTransferAmount))
          .accounts({
            source: user1TokenAccount,
            destination: user2TokenAccount,
            authority: user1.publicKey,
            euroMint: euroMint,
            sourceKycUser: kycUser1,
            destinationKycUser: kycUser2,
            kycOracleState: kycOracleState,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([user1])
          .rpc();
          
        assert.fail('Should not be able to transfer more than the limit for level 1 users');
      } catch (error) {
        // Expected error
        assert.include(error.toString(), 'failed', 'Expected excessive transfer to fail');
      }
    });

    it('Prevents transfers to unverified users', async () => {
      // Try to transfer tokens to nonVerifiedUser (not KYC verified)
      const transferAmount = 10 * 10**TOKEN_DECIMALS; // 10 EUR
      
      try {
        await program.methods
          .transferTokens(new anchor.BN(transferAmount))
          .accounts({
            source: user1TokenAccount,
            destination: nonVerifiedTokenAccount,
            authority: user1.publicKey,
            euroMint: euroMint,
            sourceKycUser: kycUser1,
            destinationKycUser: PublicKey.default, // No KYC user
            kycOracleState: kycOracleState,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([user1])
          .rpc();
          
        assert.fail('Should not be able to transfer tokens to unverified users');
      } catch (error) {
        // Expected error
        assert.include(error.toString(), 'failed', 'Expected transfer to unverified user to fail');
      }
    });

    it('Allows transfers between verified users', async () => {
      // Verify user3
      await program.methods
        .updateKycStatus(
          { verified: {} },
          1, // Level 1
          365 // 365 days validity
        )
        .accounts({
          authority: authority.publicKey,
          oracleState: kycOracleState,
          kycUser: kycUser3,
        })
        .signers([authority])
        .rpc();
        
      // Transfer from user1 to user3
      const transferAmount = 50 * 10**TOKEN_DECIMALS; // 50 EUR
      
      await program.methods
        .transferTokens(new anchor.BN(transferAmount))
        .accounts({
          source: user1TokenAccount,
          destination: user3TokenAccount,
          authority: user1.publicKey,
          euroMint: euroMint,
          sourceKycUser: kycUser1,
          destinationKycUser: kycUser3,
          kycOracleState: kycOracleState,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([user1])
        .rpc();
        
      // Check the balances
      const user3AccountInfo = await getAccount(
        connection,
        user3TokenAccount,
        undefined,
        TOKEN_2022_PROGRAM_ID
      );
      
      assert.equal(user3AccountInfo.amount.toString(), transferAmount.toString(), "Transfer amount should be correct");
    });
  });

  describe('Permanent Delegate Tests', () => {
    it('Allows authority to seize tokens using permanent delegate', async () => {
      // Use permanent delegate (authority) to seize tokens from user3
      const seizeAmount = 25 * 10**TOKEN_DECIMALS; // 25 EUR
      
      await program.methods
        .seizeTokens(new anchor.BN(seizeAmount))
        .accounts({
          authority: authority.publicKey,
          source: user3TokenAccount,
          destination: user1TokenAccount, // Sending back to user1
          euroMint: euroMint,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([authority])
        .rpc();
        
      // Check the balances
      const user3AccountInfo = await getAccount(
        connection,
        user3TokenAccount,
        undefined,
        TOKEN_2022_PROGRAM_ID
      );
      
      const expectedRemainingAmount = 25 * 10**TOKEN_DECIMALS; // 50 - 25 = 25 EUR
      assert.equal(user3AccountInfo.amount.toString(), expectedRemainingAmount.toString(), "Remaining amount should be correct after seizure");
    });
  });

  describe('Burn Tests', () => {
    it('Allows the authority to burn tokens', async () => {
      // Burn tokens from user2
      const burnAmount = 50 * 10**TOKEN_DECIMALS; // 50 EUR
      
      // Check balance before
      const beforeBurn = await getAccount(
        connection,
        user2TokenAccount,
        undefined,
        TOKEN_2022_PROGRAM_ID
      );
      
      await program.methods
        .burnTokens(new anchor.BN(burnAmount))
        .accounts({
          authority: authority.publicKey,
          euroMint: euroMint,
          source: user2TokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([authority])
        .rpc();
        
      // Check balance after
      const afterBurn = await getAccount(
        connection,
        user2TokenAccount,
        undefined,
        TOKEN_2022_PROGRAM_ID
      );
      
      const expectedRemainingAmount = new anchor.BN(beforeBurn.amount.toString()).sub(new anchor.BN(burnAmount)).toString();
      assert.equal(afterBurn.amount.toString(), expectedRemainingAmount, "Remaining amount should be correct after burning");
    });
    
    it('Prevents unauthorized users from burning tokens', async () => {
      // Try to burn tokens with unauthorized user
      const burnAmount = 10 * 10**TOKEN_DECIMALS; // 10 EUR
      
      try {
        await program.methods
          .burnTokens(new anchor.BN(burnAmount))
          .accounts({
            authority: user1.publicKey, // Not the mint authority
            euroMint: euroMint,
            source: user1TokenAccount,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([user1])
          .rpc();
          
        assert.fail('Should not be able to burn tokens with unauthorized user');
      } catch (error) {
        // Expected error
        assert.include(error.toString(), 'failed', 'Expected unauthorized burn to fail');
      }
    });
  });

  describe('Reserve Account Tests', () => {
    it('Allows updating the reserve proof', async () => {
      const reserveAmount = 1000000 * 10**TOKEN_DECIMALS; // 1,000,000 EUR
      const reserveProofUrl = "https://example.com/reserve-proof-20230101";
      
      await program.methods
        .updateReserveProof(
          new anchor.BN(reserveAmount),
          reserveProofUrl
        )
        .accounts({
          authority: authority.publicKey,
          reserveAccount: reserveAccount,
        })
        .signers([authority])
        .rpc();
        
      // Verify reserve proof was updated
      const reserveInfo = await program.account.reserveAccount.fetch(reserveAccount);
      assert.equal(reserveInfo.reserveAmount.toString(), reserveAmount.toString(), "Reserve amount should match");
      assert.equal(reserveInfo.reserveProofUrl, reserveProofUrl, "Reserve proof URL should match");
      assert.isAbove(reserveInfo.lastUpdated, 0, "Last updated timestamp should be set");
    });
    
    it('Prevents unauthorized users from updating the reserve proof', async () => {
      const reserveAmount = 2000000 * 10**TOKEN_DECIMALS; // 2,000,000 EUR
      const reserveProofUrl = "https://example.com/reserve-proof-20230102";
      
      try {
        await program.methods
          .updateReserveProof(
            new anchor.BN(reserveAmount),
            reserveProofUrl
          )
          .accounts({
            authority: user1.publicKey, // Not the authority
            reserveAccount: reserveAccount,
          })
          .signers([user1])
          .rpc();
          
        assert.fail('Should not be able to update reserve proof with unauthorized user');
      } catch (error) {
        // Expected error
        assert.include(error.toString(), 'failed', 'Expected unauthorized reserve proof update to fail');
      }
    });
  });
}); 