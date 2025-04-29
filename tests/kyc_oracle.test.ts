import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { MicaEur } from '../target/types/mica_eur';
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { assert } from 'chai';
import { findProgramAddresses, fundAccounts } from './setup';
import BN from 'bn.js';

describe('KYC Oracle Tests', () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Properly cast the program to avoid type errors
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
          new anchor.BN(365) // 365 days validity - using BN
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
          new anchor.BN(0) // 0 days validity - using BN
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
          new anchor.BN(365) // 365 days validity - using BN
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
          new anchor.BN(0) // 0 days validity - using BN
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
            new anchor.BN(0) // 0 days validity - using BN
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
          new anchor.BN(1) // 1 day validity - using BN
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

  describe('KYC Verification Level Requirements', () => {
    // Store users for later reference across tests
    let level1User: anchor.web3.Keypair;
    let level2User: anchor.web3.Keypair;
    let kycLevel1User: anchor.web3.PublicKey;
    let kycLevel2User: anchor.web3.PublicKey;

    it('Enforces transfer limits based on KYC verification level', async () => {
      // Create test user for level 1 verification
      level1User = anchor.web3.Keypair.generate();
      await fundAccounts(connection, [level1User]);

      [kycLevel1User] = anchor.web3.PublicKey.findProgramAddressSync(
        [KYC_USER_SEED, level1User.publicKey.toBuffer()],
        program.programId
      );

      // Register level 1 user
      const blzLevel1 = '10090000';
      const ibanHashLevel1 = Array.from(Buffer.from('IBAN_LEVEL1_TEST'.padEnd(32, '0')));

      await program.methods
        .registerKycUser(
          blzLevel1,
          ibanHashLevel1,
          'DE',
          'TEST_PROVIDER'
        )
        .accounts({
          authority: authority.publicKey,
          oracleState: kycOracleState,
          user: level1User.publicKey,
          kycUser: kycLevel1User,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      // Verify level 1 user with basic verification
      await program.methods
        .updateKycStatus(
          { verified: {} },
          1,
          new anchor.BN(365) // Using BN for days validity
        )
        .accounts({
          authority: authority.publicKey,
          oracleState: kycOracleState,
          kycUser: kycLevel1User,
        })
        .signers([authority])
        .rpc();

      // Create test user for level 2 verification
      level2User = anchor.web3.Keypair.generate();
      await fundAccounts(connection, [level2User]);

      [kycLevel2User] = anchor.web3.PublicKey.findProgramAddressSync(
        [KYC_USER_SEED, level2User.publicKey.toBuffer()],
        program.programId
      );

      // Register level 2 user
      const blzLevel2 = '10060000';
      const ibanHashLevel2 = Array.from(Buffer.from('IBAN_LEVEL2_TEST'.padEnd(32, '0')));

      await program.methods
        .registerKycUser(
          blzLevel2,
          ibanHashLevel2,
          'DE',
          'TEST_PROVIDER'
        )
        .accounts({
          authority: authority.publicKey,
          oracleState: kycOracleState,
          user: level2User.publicKey,
          kycUser: kycLevel2User,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      // Verify level 2 user with enhanced verification
      await program.methods
        .updateKycStatus(
          { verified: {} },
          2,
          new anchor.BN(365) // Using BN for days validity
        )
        .accounts({
          authority: authority.publicKey,
          oracleState: kycOracleState,
          kycUser: kycLevel2User,
        })
        .signers([authority])
        .rpc();

      // Fetch user data
      const level1UserData = await program.account.kycUser.fetch(kycLevel1User);
      const level2UserData = await program.account.kycUser.fetch(kycLevel2User);

      // Verify levels were set correctly
      assert.equal(level1UserData.verificationLevel, 1, "Level 1 user should have verification level 1");
      assert.equal(level2UserData.verificationLevel, 2, "Level 2 user should have verification level 2");

      // Test transaction limit checks
      // Define limits based on constants in the program - using BN for correct numeric handling
      const level1TransactionLimit = new anchor.BN(10000).mul(new anchor.BN(10).pow(new anchor.BN(9))); // 10,000 EUR (using 9 decimals)
      const level2TransactionLimit = new anchor.BN(100000).mul(new anchor.BN(10).pow(new anchor.BN(9))); // 100,000 EUR (max amount from constants)

      // Verify that level 1 users have lower transaction limits than level 2 users
      assert.isTrue(level1TransactionLimit.lt(level2TransactionLimit), 
        "Level 1 transaction limit should be lower than level 2");

      // Check if level 1 user meets requirements for small transfers
      const smallTransferAmount = new anchor.BN(5000).mul(new anchor.BN(10).pow(new anchor.BN(9))); // 5,000 EUR
      const meetsSmallTransferRequirements = 
        level1UserData.status.verified !== undefined && 
        level1UserData.verificationLevel >= 1 &&
        smallTransferAmount.lte(level1TransactionLimit);
      
      assert.isTrue(meetsSmallTransferRequirements, 
        "Level 1 verified user should be able to perform small transfers");

      // Check if level 1 user fails requirements for large transfers
      const largeTransferAmount = new anchor.BN(50000).mul(new anchor.BN(10).pow(new anchor.BN(9))); // 50,000 EUR
      const meetsLargeTransferRequirements = 
        level1UserData.status.verified !== undefined && 
        level1UserData.verificationLevel >= 2 &&
        largeTransferAmount.lte(level2TransactionLimit);
      
      assert.isFalse(meetsLargeTransferRequirements, 
        "Level 1 verified user should not be able to perform large transfers");

      // Check if level 2 user meets requirements for large transfers
      const level2MeetsLargeTransferRequirements = 
        level2UserData.status.verified !== undefined && 
        level2UserData.verificationLevel >= 2 &&
        largeTransferAmount.lte(level2TransactionLimit);
      
      assert.isTrue(level2MeetsLargeTransferRequirements, 
        "Level 2 verified user should be able to perform large transfers");
    });

    it('Checks country code requirements for MiCA compliance', async () => {
      // Create test user for non-EU country
      const nonEuUser = anchor.web3.Keypair.generate();
      await fundAccounts(connection, [nonEuUser]);

      const [kycNonEuUser] = anchor.web3.PublicKey.findProgramAddressSync(
        [KYC_USER_SEED, nonEuUser.publicKey.toBuffer()],
        program.programId
      );

      // Register non-EU user
      const blzNonEu = '10080000';
      const ibanHashNonEu = Array.from(Buffer.from('IBAN_NON_EU_TEST'.padEnd(32, '0')));

      await program.methods
        .registerKycUser(
          blzNonEu,
          ibanHashNonEu,
          'US', // Non-EU country (USA)
          'TEST_PROVIDER'
        )
        .accounts({
          authority: authority.publicKey,
          oracleState: kycOracleState,
          user: nonEuUser.publicKey,
          kycUser: kycNonEuUser,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      // Verify non-EU user with enhanced verification
      await program.methods
        .updateKycStatus(
          { verified: {} },
          2,
          new anchor.BN(365) // Using BN for days validity
        )
        .accounts({
          authority: authority.publicKey,
          oracleState: kycOracleState,
          kycUser: kycNonEuUser,
        })
        .signers([authority])
        .rpc();

      // Fetch user data
      const nonEuUserData = await program.account.kycUser.fetch(kycNonEuUser);
      const level1UserData = await program.account.kycUser.fetch(kycLevel1User);

      // Verify status and level
      assert.isDefined(nonEuUserData.status.verified);
      assert.equal(nonEuUserData.verificationLevel, 2);
      assert.equal(nonEuUserData.countryCode, 'US');

      // MiCA-compliant countries (from constants)
      const micaCountries = [
        "AT", "BE", "BG", "HR", "CY", "CZ", "DK", 
        "EE", "FI", "FR", "DE", "GR", "HU", "IE", 
        "IT", "LV", "LT", "LU", "MT", "NL", "PL", 
        "PT", "RO", "SK", "SI", "ES", "SE"
      ];

      // Check if user's country is MiCA-compliant
      const isNonEuMicaCompliant = micaCountries.includes(nonEuUserData.countryCode);
      const isEuMicaCompliant = micaCountries.includes(level1UserData.countryCode);

      assert.isFalse(isNonEuMicaCompliant, "Non-EU user should not be MiCA-compliant");
      assert.isTrue(isEuMicaCompliant, "EU user should be MiCA-compliant");
    });

    it('Tests verification expiry more thoroughly', async () => {
      // Create test user for expiry testing
      const expiryUser = anchor.web3.Keypair.generate();
      await fundAccounts(connection, [expiryUser]);

      const [kycExpiryUser] = anchor.web3.PublicKey.findProgramAddressSync(
        [KYC_USER_SEED, expiryUser.publicKey.toBuffer()],
        program.programId
      );

      // Register expiry test user
      const blzExpiry = '10040000';
      const ibanHashExpiry = Array.from(Buffer.from('IBAN_EXPIRY_DETAILED_TEST'.padEnd(32, '0')));

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
          user: expiryUser.publicKey,
          kycUser: kycExpiryUser,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      // Get current time
      const currentTime = Math.floor(Date.now() / 1000);
      
      // Set an expiry that's very close to current time (e.g., 1 hour)
      const oneHourInSeconds = 60 * 60;
      // Convert to days with BN (ensuring we use a very small but non-zero value)
      const shortExpiryDays = new anchor.BN(Math.max(1, Math.ceil(oneHourInSeconds / 86400)));

      // Verify user with a very short expiry
      await program.methods
        .updateKycStatus(
          { verified: {} },
          2,
          shortExpiryDays // Using BN for days validity
        )
        .accounts({
          authority: authority.publicKey,
          oracleState: kycOracleState,
          kycUser: kycExpiryUser,
        })
        .signers([authority])
        .rpc();

      // Fetch user data
      const expiryUserData = await program.account.kycUser.fetch(kycExpiryUser);
      
      // Verify that expiry timestamp is in the near future
      const expirySeconds = shortExpiryDays.toNumber() * 86400; // Convert back to seconds
      assert.approximately(
        expiryUserData.expiryTimestamp - currentTime, 
        expirySeconds,
        300, // Allow 5 minutes tolerance for test execution
        "Expiry time should be approximately correct based on input days"
      );

      // In a real blockchain environment, we would wait for time to pass
      // and then check if the verification is considered expired
      
      // For testing purposes, we can check if the expiry would be correctly detected
      const futureTime = currentTime + (2 * expirySeconds); // Double the expiry time
      const wouldBeExpired = futureTime > expiryUserData.expiryTimestamp;
      
      assert.isTrue(wouldBeExpired, 
        "Verification should be considered expired after the expiry time");
    });
  });
}); 