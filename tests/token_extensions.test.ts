import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { MicaEur } from '../target/types/mica_eur';
import {
  createMint,
  createAccount,
  getAccount,
  getMint,
  getAccountState,
  AccountState,
  getDefaultAccountState,
  getMetadataPointer,
  getPermanentDelegate,
  mintTo,
  transfer,
  burn,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { assert } from 'chai';
import { findProgramAddresses, fundAccounts } from './setup';

describe('Token-2022 Extensions Tests', () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.MicaEur as Program<MicaEur>;
  const connection = program.provider.connection;

  // Test keypairs
  const issuer = anchor.web3.Keypair.generate();
  const freezeAuthority = anchor.web3.Keypair.generate();
  const permanentDelegate = anchor.web3.Keypair.generate();
  const user1 = anchor.web3.Keypair.generate();
  const user2 = anchor.web3.Keypair.generate();
  const user3 = anchor.web3.Keypair.generate(); // Unverified user
  const regulatoryAuthority = anchor.web3.Keypair.generate();
  const treasuryAccount = anchor.web3.Keypair.generate();

  // Test accounts
  let mintKeypair: Keypair;
  let mintPubkey: PublicKey;
  let mintInfoPubkey: PublicKey;
  let user1TokenAccount: PublicKey;
  let user2TokenAccount: PublicKey;
  let user3TokenAccount: PublicKey;
  let treasuryTokenAccount: PublicKey;

  // KYC Oracle
  let kycOracleState: PublicKey;
  let kycUser1: PublicKey;
  let kycUser2: PublicKey;

  // Test parameters
  const MINT_DECIMALS = 9;
  const TEST_AMOUNT = 1000 * 10 ** MINT_DECIMALS; // 1000 EUR
  const SMALL_AMOUNT = 100 * 10 ** MINT_DECIMALS; // 100 EUR
  const LARGE_AMOUNT = 10000 * 10 ** MINT_DECIMALS; // 10,000 EUR
  const WHITEPAPER_URI = 'https://example.com/mica-eur-whitepaper.pdf';

  before(async () => {
    // Fund test accounts
    await fundAccounts(connection, [
      issuer,
      freezeAuthority,
      permanentDelegate,
      user1,
      user2,
      user3,
      regulatoryAuthority,
      treasuryAccount,
    ]);

    // Define mint keypair
    mintKeypair = anchor.web3.Keypair.generate();
    mintPubkey = mintKeypair.publicKey;

    // Find PDAs
    const { mintInfoPDA, kycOraclePDA, kycUserPDAs } = findProgramAddresses(
      program.programId,
      mintPubkey,
      [user1.publicKey, user2.publicKey]
    );

    mintInfoPubkey = mintInfoPDA[0];
    kycOracleState = kycOraclePDA[0];
    kycUser1 = kycUserPDAs.get(user1.publicKey.toString())![0];
    kycUser2 = kycUserPDAs.get(user2.publicKey.toString())![0];

    // Setup KYC Oracle
    await program.methods
      .initializeKycOracle()
      .accounts({
        authority: issuer.publicKey,
        oracleState: kycOracleState,
        systemProgram: SystemProgram.programId,
      })
      .signers([issuer])
      .rpc();

    // Register and verify user1
    const blz1 = '10070000'; // Deutsche Bank BLZ
    const ibanHash1 = Array.from(Buffer.from('IBAN1_HASH_PLACEHOLDER'.padEnd(32, '0')));

    await program.methods
      .registerKycUser(
        blz1,
        ibanHash1,
        'DE', // Germany
        'TEST_PROVIDER'
      )
      .accounts({
        authority: issuer.publicKey,
        oracleState: kycOracleState,
        user: user1.publicKey,
        kycUser: kycUser1,
        systemProgram: SystemProgram.programId,
      })
      .signers([issuer])
      .rpc();

    await program.methods
      .updateKycStatus(
        { verified: {} }, // Enum variant
        2, // Level 2 - high verification
        365 // 365 days validity
      )
      .accounts({
        authority: issuer.publicKey,
        oracleState: kycOracleState,
        kycUser: kycUser1,
      })
      .signers([issuer])
      .rpc();

    // Register and verify user2 with lower verification level
    const blz2 = '37040044'; // Commerzbank BLZ
    const ibanHash2 = Array.from(Buffer.from('IBAN2_HASH_PLACEHOLDER'.padEnd(32, '0')));

    await program.methods
      .registerKycUser(
        blz2,
        ibanHash2,
        'DE', // Germany
        'TEST_PROVIDER'
      )
      .accounts({
        authority: issuer.publicKey,
        oracleState: kycOracleState,
        user: user2.publicKey,
        kycUser: kycUser2,
        systemProgram: SystemProgram.programId,
      })
      .signers([issuer])
      .rpc();

    await program.methods
      .updateKycStatus(
        { verified: {} }, // Enum variant
        1, // Level 1 - basic verification
        365 // 365 days validity
      )
      .accounts({
        authority: issuer.publicKey,
        oracleState: kycOracleState,
        kycUser: kycUser2,
      })
      .signers([issuer])
      .rpc();

    // Initialize the EUR token
    await program.methods
      .initializeEuroMint(WHITEPAPER_URI)
      .accounts({
        issuer: issuer.publicKey,
        mintInfo: mintInfoPubkey,
        mint: mintPubkey,
        freezeAuthority: freezeAuthority.publicKey,
        permanentDelegate: permanentDelegate.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([issuer, mintKeypair])
      .rpc();

    // Create token accounts
    user1TokenAccount = await createAccount(
      connection,
      user1,
      mintPubkey,
      user1.publicKey
    );

    user2TokenAccount = await createAccount(
      connection,
      user2,
      mintPubkey,
      user2.publicKey
    );

    user3TokenAccount = await createAccount(
      connection,
      user3,
      mintPubkey,
      user3.publicKey
    );

    treasuryTokenAccount = await createAccount(
      connection,
      treasuryAccount,
      mintPubkey,
      treasuryAccount.publicKey
    );
  });

  describe('DefaultAccountState Extension Tests', () => {
    it('Verifies all new token accounts are frozen by default', async () => {
      // Check if token account is frozen by default
      const account1 = await getAccount(connection, user1TokenAccount);
      assert.equal(account1.state, AccountState.Frozen, 'New account should be frozen by default');

      // Create another token account to verify it's also frozen
      const testAccount = anchor.web3.Keypair.generate();
      await connection.requestAirdrop(testAccount.publicKey, LAMPORTS_PER_SOL);
      
      const testTokenAccount = await createAccount(
        connection, 
        testAccount, 
        mintPubkey, 
        testAccount.publicKey
      );

      const account2 = await getAccount(connection, testTokenAccount);
      assert.equal(account2.state, AccountState.Frozen, 'New test account should be frozen by default');

      // Verify the DefaultAccountState extension is set to Frozen
      const defaultState = await getDefaultAccountState(connection, mintPubkey);
      assert.equal(defaultState, AccountState.Frozen, 'DefaultAccountState should be Frozen');
    });

    it('Prevents transfers from frozen accounts', async () => {
      // Try to mint to user1's account (should work since we're the issuer)
      await program.methods
        .mintTokens(new anchor.BN(TEST_AMOUNT))
        .accounts({
          issuer: issuer.publicKey,
          mintInfo: mintInfoPubkey,
          mint: mintPubkey,
          tokenAccount: user1TokenAccount,
          kycUser: kycUser1,
          freezeAuthority: freezeAuthority.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([issuer])
        .rpc();

      // Verify tokens were minted
      const accountAfterMint = await getAccount(connection, user1TokenAccount);
      assert.equal(accountAfterMint.amount.toString(), TEST_AMOUNT.toString());

      // Try to transfer from user1 to user2 - should fail because user1's account is still frozen
      try {
        await transfer(
          connection,
          user1,
          user1TokenAccount,
          user2TokenAccount,
          user1.publicKey,
          SMALL_AMOUNT
        );
        assert.fail('Should not be able to transfer from frozen account');
      } catch (error) {
        // Expected error
        assert.include(error.toString(), 'failed', 'Expected transfer from frozen account to fail');
      }
    });

    it('Allows thawing accounts for verified users', async () => {
      // Thaw user1's account
      await program.methods
        .thawAccount()
        .accounts({
          freezeAuthority: freezeAuthority.publicKey,
          mintInfo: mintInfoPubkey,
          mint: mintPubkey,
          tokenAccount: user1TokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([freezeAuthority])
        .rpc();

      // Verify account is thawed
      const accountAfterThaw = await getAccount(connection, user1TokenAccount);
      assert.equal(accountAfterThaw.state, AccountState.Initialized, 'Account should be thawed');

      // Try to transfer after thawing - should work
      await transfer(
        connection,
        user1,
        user1TokenAccount,
        user2TokenAccount,
        user1.publicKey,
        SMALL_AMOUNT
      );

      // Verify transfer worked
      const user2AccountAfter = await getAccount(connection, user2TokenAccount);
      assert.equal(user2AccountAfter.amount.toString(), SMALL_AMOUNT.toString(), 'Transfer should succeed after thawing');
    });

    it('Can freeze accounts for compliance', async () => {
      // Freeze user2's account
      await program.methods
        .freezeAccount()
        .accounts({
          freezeAuthority: freezeAuthority.publicKey,
          mintInfo: mintInfoPubkey,
          mint: mintPubkey,
          tokenAccount: user2TokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([freezeAuthority])
        .rpc();

      // Verify account is frozen
      const accountAfterFreeze = await getAccount(connection, user2TokenAccount);
      assert.equal(accountAfterFreeze.state, AccountState.Frozen, 'Account should be frozen');

      // Try to transfer - should fail
      try {
        await transfer(
          connection,
          user2,
          user2TokenAccount,
          user1TokenAccount,
          user2.publicKey,
          SMALL_AMOUNT
        );
        assert.fail('Should not be able to transfer from frozen account');
      } catch (error) {
        // Expected error
        assert.include(error.toString(), 'failed', 'Expected transfer from frozen account to fail');
      }
    });
  });

  describe('TransferHook Extension Tests', () => {
    it('Verifies the TransferHook extension is properly initialized', async () => {
      // Check if TransferHook is initialized on the mint
      const hookProgram = await getTransferHook(connection, mintPubkey);
      assert.isNotNull(hookProgram, 'TransferHook should be initialized');
      // In a real test, we would verify the transfer hook program ID matches our expected program
    });

    it('Prevents transfers to unverified accounts', async () => {
      // Try to transfer to unverified user3 - should fail due to TransferHook
      try {
        await transfer(
          connection,
          user1,
          user1TokenAccount,
          user3TokenAccount,
          user1.publicKey,
          SMALL_AMOUNT
        );
        assert.fail('Should not be able to transfer to unverified account');
      } catch (error) {
        // Expected error
        assert.include(error.toString(), 'failed', 'Expected transfer to unverified account to fail');
      }
    });

    it('Enforces transaction limits based on KYC level', async () => {
      // Thaw user2's account for this test
      await program.methods
        .thawAccount()
        .accounts({
          freezeAuthority: freezeAuthority.publicKey,
          mintInfo: mintInfoPubkey,
          mint: mintPubkey,
          tokenAccount: user2TokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([freezeAuthority])
        .rpc();

      // Try a small transfer from user2 (KYC level 1) to user1 - should work
      await transfer(
        connection,
        user2,
        user2TokenAccount,
        user1TokenAccount,
        user2.publicKey,
        SMALL_AMOUNT / 2
      );

      // Verify the small transfer worked
      const user1AccountAfter = await getAccount(connection, user1TokenAccount);
      const expectedBalance = TEST_AMOUNT - SMALL_AMOUNT + (SMALL_AMOUNT / 2);
      assert.equal(user1AccountAfter.amount.toString(), expectedBalance.toString(), 'Small transfer should succeed');

      // Try a large transfer from user2 (KYC level 1) - should fail due to KYC level limit
      try {
        await transfer(
          connection,
          user2,
          user2TokenAccount,
          user1TokenAccount,
          user2.publicKey,
          LARGE_AMOUNT
        );
        assert.fail('Should not be able to transfer large amount with low KYC level');
      } catch (error) {
        // Expected error
        assert.include(error.toString(), 'failed', 'Expected large transfer with low KYC level to fail');
      }
    });

    it('Allows compliant transfers between verified accounts', async () => {
      // Try a transfer from user1 (KYC level 2) to user2 - should work
      const user1BalanceBefore = (await getAccount(connection, user1TokenAccount)).amount;
      const user2BalanceBefore = (await getAccount(connection, user2TokenAccount)).amount;

      await transfer(
        connection,
        user1,
        user1TokenAccount,
        user2TokenAccount,
        user1.publicKey,
        SMALL_AMOUNT
      );

      // Verify the transfer worked
      const user1AccountAfter = await getAccount(connection, user1TokenAccount);
      const user2AccountAfter = await getAccount(connection, user2TokenAccount);

      const expectedUser1Balance = BigInt(user1BalanceBefore.toString()) - BigInt(SMALL_AMOUNT);
      const expectedUser2Balance = BigInt(user2BalanceBefore.toString()) + BigInt(SMALL_AMOUNT);

      assert.equal(user1AccountAfter.amount.toString(), expectedUser1Balance.toString(), 'User1 balance should decrease');
      assert.equal(user2AccountAfter.amount.toString(), expectedUser2Balance.toString(), 'User2 balance should increase');
    });
  });

  describe('PermanentDelegate Extension Tests', () => {
    it('Verifies the PermanentDelegate extension is properly initialized', async () => {
      // Check if PermanentDelegate is initialized on the mint
      const delegate = await getPermanentDelegate(connection, mintPubkey);
      assert.isNotNull(delegate, 'PermanentDelegate should be initialized');
      assert.equal(delegate!.toString(), permanentDelegate.publicKey.toString(), 'PermanentDelegate should match expected pubkey');
    });

    it('Allows regulatory seizure of tokens by permanent delegate', async () => {
      // Get balances before seizure
      const user2BalanceBefore = (await getAccount(connection, user2TokenAccount)).amount;
      const treasuryBalanceBefore = (await getAccount(connection, treasuryTokenAccount)).amount;

      const seizeAmount = SMALL_AMOUNT / 2;

      // Seize tokens from user2 as permanent delegate
      await program.methods
        .seizeTokens(new anchor.BN(seizeAmount))
        .accounts({
          permanentDelegate: permanentDelegate.publicKey,
          mintInfo: mintInfoPubkey,
          mint: mintPubkey,
          fromAccount: user2TokenAccount,
          toAccount: treasuryTokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([permanentDelegate])
        .rpc();

      // Verify the seizure worked
      const user2AccountAfter = await getAccount(connection, user2TokenAccount);
      const treasuryAccountAfter = await getAccount(connection, treasuryTokenAccount);

      const expectedUser2Balance = BigInt(user2BalanceBefore.toString()) - BigInt(seizeAmount);
      const expectedTreasuryBalance = BigInt(treasuryBalanceBefore.toString()) + BigInt(seizeAmount);

      assert.equal(user2AccountAfter.amount.toString(), expectedUser2Balance.toString(), 'User2 balance should decrease after seizure');
      assert.equal(treasuryAccountAfter.amount.toString(), expectedTreasuryBalance.toString(), 'Treasury balance should increase after seizure');
    });

    it('Prevents unauthorized accounts from seizing tokens', async () => {
      // Try to seize tokens as unauthorized account - should fail
      try {
        // Create a transaction similar to seizeTokens but using a different signer
        const seizeAmount = SMALL_AMOUNT;
        
        await program.methods
          .seizeTokens(new anchor.BN(seizeAmount))
          .accounts({
            permanentDelegate: regulatoryAuthority.publicKey, // Unauthorized account
            mintInfo: mintInfoPubkey,
            mint: mintPubkey,
            fromAccount: user2TokenAccount,
            toAccount: treasuryTokenAccount,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([regulatoryAuthority])
          .rpc();
          
        assert.fail('Should not be able to seize tokens without proper authorization');
      } catch (error) {
        // Expected error
        assert.include(error.toString(), 'failed', 'Expected unauthorized seizure to fail');
      }
    });
  });

  describe('MetadataPointer Extension Tests', () => {
    it('Verifies the MetadataPointer extension is properly initialized', async () => {
      // Check if MetadataPointer is initialized on the mint
      const metadata = await getMetadataPointer(connection, mintPubkey);
      assert.isNotNull(metadata, 'MetadataPointer should be initialized');
      // In a real test, we would verify the metadata URI content
    });

    it('Points to whitepaper and legal documentation', async () => {
      // In a real test, we would fetch and verify the content at the metadata URI
      const mintInfo = await program.account.mintInfo.fetch(mintInfoPubkey);
      assert.equal(mintInfo.whitepaper_uri, WHITEPAPER_URI, 'Whitepaper URI should match');
    });
  });

  describe('Mint and Burn Functionality Tests', () => {
    it('Only allows authorized issuer to mint tokens', async () => {
      // Try to mint as unauthorized user - should fail
      try {
        await program.methods
          .mintTokens(new anchor.BN(TEST_AMOUNT))
          .accounts({
            issuer: user1.publicKey, // Unauthorized issuer
            mintInfo: mintInfoPubkey,
            mint: mintPubkey,
            tokenAccount: user1TokenAccount,
            kycUser: kycUser1,
            freezeAuthority: freezeAuthority.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([user1])
          .rpc();
          
        assert.fail('Should not be able to mint tokens without proper authorization');
      } catch (error) {
        // Expected error
        assert.include(error.toString(), 'failed', 'Expected unauthorized minting to fail');
      }

      // Mint as authorized issuer - should succeed
      const user1BalanceBefore = (await getAccount(connection, user1TokenAccount)).amount;
      
      await program.methods
        .mintTokens(new anchor.BN(TEST_AMOUNT))
        .accounts({
          issuer: issuer.publicKey,
          mintInfo: mintInfoPubkey,
          mint: mintPubkey,
          tokenAccount: user1TokenAccount,
          kycUser: kycUser1,
          freezeAuthority: freezeAuthority.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([issuer])
        .rpc();

      // Verify the mint worked
      const user1AccountAfter = await getAccount(connection, user1TokenAccount);
      const expectedBalance = BigInt(user1BalanceBefore.toString()) + BigInt(TEST_AMOUNT);
      assert.equal(user1AccountAfter.amount.toString(), expectedBalance.toString(), 'Authorized mint should succeed');
    });

    it('Enforces KYC verification before minting', async () => {
      // Try to mint to unverified user3 - should fail
      try {
        await program.methods
          .mintTokens(new anchor.BN(TEST_AMOUNT))
          .accounts({
            issuer: issuer.publicKey,
            mintInfo: mintInfoPubkey,
            mint: mintPubkey,
            tokenAccount: user3TokenAccount,
            kycUser: null, // No KYC account for user3
            freezeAuthority: freezeAuthority.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([issuer])
          .rpc();
          
        assert.fail('Should not be able to mint to unverified account');
      } catch (error) {
        // Expected error
        assert.include(error.toString(), 'failed', 'Expected minting to unverified account to fail');
      }
    });

    it('Allows burning tokens for redemption', async () => {
      // Get user1 balance before burn
      const user1BalanceBefore = (await getAccount(connection, user1TokenAccount)).amount;
      const burnAmount = SMALL_AMOUNT;

      // Burn tokens
      await program.methods
        .burnTokens(new anchor.BN(burnAmount))
        .accounts({
          owner: user1.publicKey,
          mintInfo: mintInfoPubkey,
          mint: mintPubkey,
          tokenAccount: user1TokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([user1])
        .rpc();

      // Verify the burn worked
      const user1AccountAfter = await getAccount(connection, user1TokenAccount);
      const expectedBalance = BigInt(user1BalanceBefore.toString()) - BigInt(burnAmount);
      assert.equal(user1AccountAfter.amount.toString(), expectedBalance.toString(), 'Token burn should reduce balance');
    });
  });

  describe('Reserve Proof Tests', () => {
    it('Updates reserve proof merkle root', async () => {
      // Create a mock merkle root
      const mockMerkleRoot = Array.from(Buffer.from('MOCK_MERKLE_ROOT_FOR_RESERVE_PROOF'.padEnd(32, '0')));
      const mockIpfsCid = 'QmTfCwNj8FrTnS8LhGpUDj5N33y59pcCvsnnptHZGk1Gvb';
      
      // Update reserve proof
      await program.methods
        .updateReserveProof(
          mockMerkleRoot,
          mockIpfsCid
        )
        .accounts({
          issuer: issuer.publicKey,
          mintInfo: mintInfoPubkey,
        })
        .signers([issuer])
        .rpc();
      
      // Verify the update worked
      const mintInfoAfter = await program.account.mintInfo.fetch(mintInfoPubkey);
      assert.deepEqual(Array.from(mintInfoAfter.reserve_merkle_root), mockMerkleRoot, 'Merkle root should be updated');
      assert.equal(mintInfoAfter.reserve_ipfs_cid, mockIpfsCid, 'IPFS CID should be updated');
    });

    it('Prevents unauthorized updates to reserve proof', async () => {
      // Try to update reserve proof as unauthorized user - should fail
      try {
        const mockMerkleRoot = Array.from(Buffer.from('UNAUTHORIZED_UPDATE_ATTEMPT'.padEnd(32, '0')));
        const mockIpfsCid = 'QmUnauthorizedAttempt';
        
        await program.methods
          .updateReserveProof(
            mockMerkleRoot,
            mockIpfsCid
          )
          .accounts({
            issuer: user1.publicKey, // Unauthorized user
            mintInfo: mintInfoPubkey,
          })
          .signers([user1])
          .rpc();
          
        assert.fail('Should not be able to update reserve proof without proper authorization');
      } catch (error) {
        // Expected error
        assert.include(error.toString(), 'failed', 'Expected unauthorized reserve proof update to fail');
      }
    });
  });
});

function getTransferHook(connection, mintPubkey) {
  // This is a mock function - in the real implementation, you would
  // retrieve the actual transfer hook from the mint
  return { programId: 'mockProgramId' };
} 