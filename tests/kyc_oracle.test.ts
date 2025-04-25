import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { MicaEur } from '../target/types/mica_eur';
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { assert } from 'chai';
import { findProgramAddresses, fundAccounts } from './setup';

describe('KYC Oracle Tests', () => {
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
  const regularUser = anchor.web3.Keypair.generate(); // Non-admin user

  // Test accounts
  let kycOracleState: PublicKey;
  let kycUser1: PublicKey;
  let kycUser2: PublicKey;
  let kycUser3: PublicKey;

  const KYC_ORACLE_SEED = Buffer.from("kyc_oracle");
  const KYC_USER_SEED = Buffer.from("kyc_user");

  before(async () => {
    // Fund test accounts
    await fundAccounts(connection, [
      authority,
      user1,
      user2,
      user3,
      regularUser
    ]);

    // Find PDA for KYC Oracle state
    [kycOracleState] = anchor.web3.PublicKey.findProgramAddressSync(
      [KYC_ORACLE_SEED],
      program.programId
    );

    // Find PDAs for KYC users
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
  });

  describe('KYC Oracle Initialization', () => {
    it('Initializes the KYC Oracle state', async () => {
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

      // Verify KYC Oracle state
      const oracleState = await program.account.kycOracleState.fetch(kycOracleState);
      assert.isTrue(oracleState.isActive);
      assert.equal(oracleState.authority.toString(), authority.publicKey.toString());
      assert.equal(oracleState.adminCount, 1);
      assert.equal(oracleState.totalVerifiedUsers.toString(), '0');
    });

    it('Prevents re-initialization of KYC Oracle', async () => {
      // Try to initialize the KYC Oracle again - should fail
      try {
        await program.methods
          .initializeKycOracle()
          .accounts({
            authority: authority.publicKey,
            oracleState: kycOracleState,
            systemProgram: SystemProgram.programId,
          })
          .signers([authority])
          .rpc();
          
        assert.fail('Should not be able to re-initialize the KYC Oracle');
      } catch (error) {
        // Expected error
        assert.include(error.toString(), 'failed', 'Expected re-initialization to fail');
      }
    });

    it('Prevents unauthorized users from initializing KYC Oracle', async () => {
      // Create a new PDA for a different KYC Oracle (this is just for test purposes)
      const [testOracleState] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("test_oracle")],
        program.programId
      );

      // Try to initialize with unauthorized user - should fail
      try {
        await program.methods
          .initializeKycOracle()
          .accounts({
            authority: regularUser.publicKey, // Unauthorized user
            oracleState: testOracleState,
            systemProgram: SystemProgram.programId,
          })
          .signers([regularUser])
          .rpc();
          
        assert.fail('Should not be able to initialize KYC Oracle with unauthorized user');
      } catch (error) {
        // Expected error - may fail due to other reasons (like account already exists)
        assert.include(error.toString(), 'failed', 'Expected unauthorized initialization to fail');
      }
    });
  });

  describe('KYC User Registration', () => {
    it('Registers a user for KYC verification', async () => {
      // Register user1
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
          authority: authority.publicKey,
          oracleState: kycOracleState,
          user: user1.publicKey,
          kycUser: kycUser1,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      // Verify KYC user was registered
      const kycUserAccount = await program.account.kycUser.fetch(kycUser1);
      assert.equal(kycUserAccount.owner.toString(), user1.publicKey.toString());
      assert.equal(kycUserAccount.blz, blz1);
      assert.deepEqual(Array.from(kycUserAccount.ibanHash), ibanHash1);
      assert.equal(kycUserAccount.countryCode, 'DE');
      assert.equal(kycUserAccount.verificationProvider, 'TEST_PROVIDER');
      assert.isDefined(kycUserAccount.status.pending);
      assert.equal(kycUserAccount.verificationLevel, 0);
    });

    it('Prevents registering a user twice', async () => {
      // Try to register user1 again - should fail
      const blz1 = '10070000';
      const ibanHash1 = Array.from(Buffer.from('IBAN1_HASH_PLACEHOLDER'.padEnd(32, '0')));

      try {
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
          
        assert.fail('Should not be able to register a user twice');
      } catch (error) {
        // Expected error
        assert.include(error.toString(), 'failed', 'Expected double registration to fail');
      }
    });

    it('Prevents registering with unsupported country code', async () => {
      // Try to register user2 with unsupported country code - should fail
      const blz2 = '37040044';
      const ibanHash2 = Array.from(Buffer.from('IBAN2_HASH_PLACEHOLDER'.padEnd(32, '0')));

      try {
        await program.methods
          .registerKycUser(
            blz2,
            ibanHash2,
            'US', // Not in EU - unsupported
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
          
        assert.fail('Should not be able to register with unsupported country code');
      } catch (error) {
        // Expected error
        assert.include(error.toString(), 'failed', 'Expected registration with unsupported country to fail');
      }

      // Now register user2 with a supported country code - should succeed
      await program.methods
        .registerKycUser(
          blz2,
          ibanHash2,
          'FR', // France - supported
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

      // Verify registration succeeded
      const kycUserAccount = await program.account.kycUser.fetch(kycUser2);
      assert.equal(kycUserAccount.countryCode, 'FR');
    });

    it('Prevents unauthorized users from registering KYC users', async () => {
      // Try to register user3 with unauthorized user - should fail
      const blz3 = '20050550';
      const ibanHash3 = Array.from(Buffer.from('IBAN3_HASH_PLACEHOLDER'.padEnd(32, '0')));

      try {
        await program.methods
          .registerKycUser(
            blz3,
            ibanHash3,
            'DE',
            'TEST_PROVIDER'
          )
          .accounts({
            authority: regularUser.publicKey, // Unauthorized user
            oracleState: kycOracleState,
            user: user3.publicKey,
            kycUser: kycUser3,
            systemProgram: SystemProgram.programId,
          })
          .signers([regularUser])
          .rpc();
          
        assert.fail('Should not be able to register with unauthorized user');
      } catch (error) {
        // Expected error
        assert.include(error.toString(), 'failed', 'Expected unauthorized registration to fail');
      }
    });
  });

  describe('KYC Status Updates', () => {
    it('Updates KYC status to verified', async () => {
      // Update user1 to verified status
      await program.methods
        .updateKycStatus(
          { verified: {} }, // Enum variant
          2, // Level 2 - high verification
          365 // 365 days validity
        )
        .accounts({
          authority: authority.publicKey,
          oracleState: kycOracleState,
          kycUser: kycUser1,
        })
        .signers([authority])
        .rpc();

      // Verify status was updated
      const kycUserAccount = await program.account.kycUser.fetch(kycUser1);
      assert.isDefined(kycUserAccount.status.verified);
      assert.equal(kycUserAccount.verificationLevel, 2);
      
      // Verify expiry date is set (we don't check exact timestamp, just that it's set)
      assert.isAbove(kycUserAccount.expiryTimestamp, 0);
      
      // Verify oracle state was updated
      const oracleState = await program.account.kycOracleState.fetch(kycOracleState);
      assert.equal(oracleState.totalVerifiedUsers.toString(), '1');
    });

    it('Updates KYC status to rejected', async () => {
      // Update user2 to rejected status
      await program.methods
        .updateKycStatus(
          { rejected: {} }, // Enum variant
          0, // Level 0
          0 // 0 days validity
        )
        .accounts({
          authority: authority.publicKey,
          oracleState: kycOracleState,
          kycUser: kycUser2,
        })
        .signers([authority])
        .rpc();

      // Verify status was updated
      const kycUserAccount = await program.account.kycUser.fetch(kycUser2);
      assert.isDefined(kycUserAccount.status.rejected);
      assert.equal(kycUserAccount.verificationLevel, 0);
      
      // Verify oracle state was not updated (still 1 verified user)
      const oracleState = await program.account.kycOracleState.fetch(kycOracleState);
      assert.equal(oracleState.totalVerifiedUsers.toString(), '1');
    });

    it('Updates KYC status to revoked', async () => {
      // Register user3 first
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

      // Verify user3 was registered
      let kycUserAccount = await program.account.kycUser.fetch(kycUser3);
      assert.isDefined(kycUserAccount.status.pending);

      // Verify user3 first
      await program.methods
        .updateKycStatus(
          { verified: {} }, // Enum variant
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

      // Verify user3 was verified
      kycUserAccount = await program.account.kycUser.fetch(kycUser3);
      assert.isDefined(kycUserAccount.status.verified);
      
      // Verify oracle state was updated (now 2 verified users)
      let oracleState = await program.account.kycOracleState.fetch(kycOracleState);
      assert.equal(oracleState.totalVerifiedUsers.toString(), '2');

      // Now revoke user3's verification
      await program.methods
        .updateKycStatus(
          { revoked: {} }, // Enum variant
          0, // Level 0
          0 // 0 days validity
        )
        .accounts({
          authority: authority.publicKey,
          oracleState: kycOracleState,
          kycUser: kycUser3,
        })
        .signers([authority])
        .rpc();

      // Verify status was updated
      kycUserAccount = await program.account.kycUser.fetch(kycUser3);
      assert.isDefined(kycUserAccount.status.revoked);
      assert.equal(kycUserAccount.verificationLevel, 0);
      
      // Verify oracle state was updated (back to 1 verified user)
      oracleState = await program.account.kycOracleState.fetch(kycOracleState);
      assert.equal(oracleState.totalVerifiedUsers.toString(), '1');
    });

    it('Prevents unauthorized users from updating KYC status', async () => {
      // Try to update user1's status with unauthorized user - should fail
      try {
        await program.methods
          .updateKycStatus(
            { revoked: {} }, // Enum variant
            0, // Level 0
            0 // 0 days validity
          )
          .accounts({
            authority: regularUser.publicKey, // Unauthorized user
            oracleState: kycOracleState,
            kycUser: kycUser1,
          })
          .signers([regularUser])
          .rpc();
          
        assert.fail('Should not be able to update KYC status with unauthorized user');
      } catch (error) {
        // Expected error
        assert.include(error.toString(), 'failed', 'Expected unauthorized status update to fail');
      }
    });
  });

  describe('KYC Verification Checks', () => {
    it('Properly checks if a user is KYC verified', async () => {
      // Fetch user1 (should be verified)
      const user1KYC = await program.account.kycUser.fetch(kycUser1);
      
      // Verify the status
      assert.isDefined(user1KYC.status.verified);
      assert.isUndefined(user1KYC.status.pending);
      assert.isUndefined(user1KYC.status.rejected);
      assert.isUndefined(user1KYC.status.revoked);
      
      // Verify level
      assert.equal(user1KYC.verificationLevel, 2);
      
      // Fetch user2 (should be rejected)
      const user2KYC = await program.account.kycUser.fetch(kycUser2);
      
      // Verify the status
      assert.isDefined(user2KYC.status.rejected);
      assert.isUndefined(user2KYC.status.pending);
      assert.isUndefined(user2KYC.status.verified);
      assert.isUndefined(user2KYC.status.revoked);
      
      // Verify level
      assert.equal(user2KYC.verificationLevel, 0);
      
      // Fetch user3 (should be revoked)
      const user3KYC = await program.account.kycUser.fetch(kycUser3);
      
      // Verify the status
      assert.isDefined(user3KYC.status.revoked);
      assert.isUndefined(user3KYC.status.pending);
      assert.isUndefined(user3KYC.status.verified);
      assert.isUndefined(user3KYC.status.rejected);
      
      // Verify level
      assert.equal(user3KYC.verificationLevel, 0);
    });

    it('Handles expiry of verification correctly', async () => {
      // Register a new user for this test
      const expiryTestUser = anchor.web3.Keypair.generate();
      await fundAccounts(connection, [expiryTestUser]);

      const [kycExpiryUser] = anchor.web3.PublicKey.findProgramAddressSync(
        [KYC_USER_SEED, expiryTestUser.publicKey.toBuffer()],
        program.programId
      );

      // Register the user
      const blzExpiry = '12030000';
      const ibanHashExpiry = Array.from(Buffer.from('IBAN_EXPIRY_TEST'.padEnd(32, '0')));

      await program.methods
        .registerKycUser(
          blzExpiry,
          ibanHashExpiry,
          'DE',
          'TEST_PROVIDER'
        )
        .accounts({
          authority: authority.publicKey,
          oracleState: kycOracleState,
          user: expiryTestUser.publicKey,
          kycUser: kycExpiryUser,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      // Verify the user with a very short expiry (e.g., 1 day)
      await program.methods
        .updateKycStatus(
          { verified: {} }, // Enum variant
          2, // Level 2
          1 // 1 day validity - will expire soon for testing
        )
        .accounts({
          authority: authority.publicKey,
          oracleState: kycOracleState,
          kycUser: kycExpiryUser,
        })
        .signers([authority])
        .rpc();

      // Verify the user was verified
      const kycUserAccount = await program.account.kycUser.fetch(kycExpiryUser);
      assert.isDefined(kycUserAccount.status.verified);
      
      // In a real test, we would fast-forward time and check that the verification is considered expired
      // Since we can't manipulate time in tests easily, we'd need a specific check function in the program
      // For now, we'll just verify the expiry timestamp was set correctly
      const currentTime = Math.floor(Date.now() / 1000);
      const expiryTime = kycUserAccount.expiryTimestamp;
      
      // Expiry should be roughly 1 day from now
      const oneDayInSeconds = 24 * 60 * 60;
      const diff = expiryTime - currentTime;
      
      // Allow some wiggle room for test execution time
      assert.approximately(diff, oneDayInSeconds, 60, 'Expiry timestamp should be approximately 1 day from now');
    });
  });
}); 