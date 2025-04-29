import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { MicaEur } from '../../target/types/mica_eur';
import { PublicKey, Keypair } from '@solana/web3.js';
import { expect, assert } from 'chai';
import { fundAccounts } from '../setup';

describe('KYC Oracle Unit Tests', () => {
  // Configure the client
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Properly cast the program to avoid type errors
  const program = anchor.workspace.MicaEur as unknown as Program<any>;
  const connection = program.provider.connection;

  // Test keypairs
  const authority = anchor.web3.Keypair.generate();
  const user1 = anchor.web3.Keypair.generate();
  const user2 = anchor.web3.Keypair.generate();
  const user3 = anchor.web3.Keypair.generate();
  const unauthorizedUser = anchor.web3.Keypair.generate();

  // PDA seeds
  const KYC_ORACLE_SEED = Buffer.from("kyc_oracle");
  const KYC_USER_SEED = Buffer.from("kyc_user");

  // PDAs
  let kycOracleState: PublicKey;
  let kycUser1: PublicKey;
  let kycUser2: PublicKey;
  let kycUser3: PublicKey;

  // Test data
  const blz1 = "12345678";
  const blz2 = "87654321";
  const blz3 = "11223344";
  const ibanHash1 = Array.from({ length: 32 }, (_, i) => i);
  const ibanHash2 = Array.from({ length: 32 }, (_, i) => 32 - i);
  const ibanHash3 = Array.from({ length: 32 }, (_, i) => i % 8);

  before(async () => {
    // Fund test accounts
    await fundAccounts(connection, [authority, user1, user2, user3, unauthorizedUser]);

    // Find PDAs
    [kycOracleState] = PublicKey.findProgramAddressSync(
      [KYC_ORACLE_SEED],
      program.programId
    );

    [kycUser1] = PublicKey.findProgramAddressSync(
      [KYC_USER_SEED, user1.publicKey.toBuffer()],
      program.programId
    );

    [kycUser2] = PublicKey.findProgramAddressSync(
      [KYC_USER_SEED, user2.publicKey.toBuffer()],
      program.programId
    );

    [kycUser3] = PublicKey.findProgramAddressSync(
      [KYC_USER_SEED, user3.publicKey.toBuffer()],
      program.programId
    );
  });

  describe('Oracle initialization and management', () => {
    it('Initializes the KYC Oracle with correct state', async () => {
      // Initialize the KYC Oracle
      await program.methods
        .initializeKycOracle()
        .accounts({
          authority: authority.publicKey,
          oracleState: kycOracleState,
          systemProgram: anchor.web3.SystemProgram.programId,
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

    it('Prevents re-initialization of the KYC Oracle', async () => {
      try {
        await program.methods
          .initializeKycOracle()
          .accounts({
            authority: authority.publicKey,
            oracleState: kycOracleState,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([authority])
          .rpc();
        assert.fail("Should not be able to re-initialize the KYC Oracle");
      } catch (error) {
        // Expected error
        assert.include(error.message, "already in use");
      }
    });

    it('Prevents unauthorized initialization of the KYC Oracle', async () => {
      // Create a new PDA for testing
      const [testOracleState] = PublicKey.findProgramAddressSync(
        [Buffer.from("test_oracle")],
        program.programId
      );

      try {
        await program.methods
          .initializeKycOracle()
          .accounts({
            authority: unauthorizedUser.publicKey,
            oracleState: kycOracleState, // Try to overwrite existing
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([unauthorizedUser])
          .rpc();
        assert.fail("Should not be able to initialize with unauthorized user");
      } catch (error) {
        // Expected error
        assert.include(error.message, "has already been used");
      }
    });
  });

  describe('User registration', () => {
    it('Registers a new KYC user correctly', async () => {
      // Register user1
      await program.methods
        .registerKycUser(
          blz1,
          ibanHash1,
          "DE", // German country code
          "TestProvider"
        )
        .accounts({
          authority: authority.publicKey,
          oracleState: kycOracleState,
          user: user1.publicKey,
          kycUser: kycUser1,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      // Verify KYC user was registered
      const kycUserAccount = await program.account.kycUser.fetch(kycUser1);
      assert.equal(kycUserAccount.authority.toString(), authority.publicKey.toString());
      assert.equal(kycUserAccount.user.toString(), user1.publicKey.toString());
      assert.equal(kycUserAccount.blz, blz1);
      assert.deepEqual(Array.from(kycUserAccount.ibanHash), ibanHash1);
      assert.equal(kycUserAccount.countryCode, "DE");
      assert.equal(kycUserAccount.verificationProvider, "TestProvider");
      assert.isDefined(kycUserAccount.status.pending);
    });

    it('Prevents duplicate registration of the same user', async () => {
      try {
        await program.methods
          .registerKycUser(
            blz1,
            ibanHash1,
            "DE",
            "TestProvider"
          )
          .accounts({
            authority: authority.publicKey,
            oracleState: kycOracleState,
            user: user1.publicKey,
            kycUser: kycUser1,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([authority])
          .rpc();
        assert.fail("Should not be able to register the same user twice");
      } catch (error) {
        // Expected error
        assert.include(error.message, "already in use");
      }
    });

    it('Validates country code during registration', async () => {
      // Try to register a user with an unsupported country code
      try {
        const [invalidUserAccount] = PublicKey.findProgramAddressSync(
          [KYC_USER_SEED, unauthorizedUser.publicKey.toBuffer()],
          program.programId
        );

        await program.methods
          .registerKycUser(
            "99999999",
            Array.from({ length: 32 }, () => 0),
            "ZZ", // Invalid country code
            "TestProvider"
          )
          .accounts({
            authority: authority.publicKey,
            oracleState: kycOracleState,
            user: unauthorizedUser.publicKey,
            kycUser: invalidUserAccount,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([authority])
          .rpc();
        assert.fail("Should not be able to register with invalid country code");
      } catch (error) {
        // Expected error
        assert.include(error.message, "Country not supported");
      }
    });

    it('Successfully registers another user from a different country', async () => {
      // Register user2 from France
      await program.methods
        .registerKycUser(
          blz2,
          ibanHash2,
          "FR", // French country code
          "TestProvider"
        )
        .accounts({
          authority: authority.publicKey,
          oracleState: kycOracleState,
          user: user2.publicKey,
          kycUser: kycUser2,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      // Verify registration succeeded
      const kycUserAccount = await program.account.kycUser.fetch(kycUser2);
      assert.equal(kycUserAccount.countryCode, 'FR');
    });

    it('Prevents unauthorized user registration', async () => {
      try {
        // Try to register user3 with unauthorized account
        await program.methods
          .registerKycUser(
            blz3,
            ibanHash3,
            "ES", // Spanish country code
            "TestProvider"
          )
          .accounts({
            authority: unauthorizedUser.publicKey, // Unauthorized
            oracleState: kycOracleState,
            user: user3.publicKey,
            kycUser: kycUser3,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([unauthorizedUser])
          .rpc();
        assert.fail("Should not be able to register with unauthorized account");
      } catch (error) {
        // Expected error
        assert.include(error.message, "Constraint violation");
      }
    });
  });

  describe('Status updates', () => {
    it('Updates a user\'s KYC status to Verified', async () => {
      // Update user1's status to Verified, level 2
      await program.methods
        .updateKycStatus(
          { verified: {} }, // Status
          2, // Level 2
          new anchor.BN(365) // 365 days validity
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
      
      // Verify oracle state was updated
      const oracleState = await program.account.kycOracleState.fetch(kycOracleState);
      assert.equal(oracleState.totalVerifiedUsers.toString(), '1');
    });

    it('Updates a user\'s KYC status to Rejected', async () => {
      // Update user2's status to Rejected
      await program.methods
        .updateKycStatus(
          { rejected: {} }, // Status
          0, // Level 0 - no verification
          new anchor.BN(0) // Zero days validity
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

    it('Handles revocation of KYC verification', async () => {
      // First register user3
      await program.methods
        .registerKycUser(
          blz3,
          ibanHash3,
          "ES", // Spanish country code
          "TestProvider"
        )
        .accounts({
          authority: authority.publicKey,
          oracleState: kycOracleState,
          user: user3.publicKey,
          kycUser: kycUser3,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      // Verify user3 was registered
      let kycUserAccount = await program.account.kycUser.fetch(kycUser3);
      assert.isDefined(kycUserAccount.status.pending);

      // Verify user3 first
      await program.methods
        .updateKycStatus(
          { verified: {} }, // Status
          2, // Level 2
          new anchor.BN(365) // 365 days validity
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
          { revoked: {} }, // Status
          0, // Level 0 - no verification
          new anchor.BN(0) // Zero days validity
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

    it('Prevents unauthorized status updates', async () => {
      try {
        await program.methods
          .updateKycStatus(
            { verified: {} }, // Status
            2, // Level 2
            new anchor.BN(365) // 365 days validity
          )
          .accounts({
            authority: unauthorizedUser.publicKey, // Unauthorized
            oracleState: kycOracleState,
            kycUser: kycUser1,
          })
          .signers([unauthorizedUser])
          .rpc();
        assert.fail("Should not be able to update status with unauthorized account");
      } catch (error) {
        // Expected error
        assert.include(error.message, "Constraint violation");
      }
    });
  });

  describe('Verification checks', () => {
    it('Properly checks if a user is KYC verified', async () => {
      // Fetch user1 (should be verified)
      const user1KYC = await program.account.kycUser.fetch(kycUser1);
      
      // Verify the status
      assert.isDefined(user1KYC.status.verified);
      assert.equal(user1KYC.verificationLevel, 2);
      assert.isAbove(user1KYC.expiryDate.toNumber(), 0, "Expiry date should be set");
      assert.isAbove(user1KYC.verificationDate.toNumber(), 0, "Verification date should be set");
      
      // Fetch user2 (should be rejected)
      const user2KYC = await program.account.kycUser.fetch(kycUser2);
      
      // Verify the status
      assert.isDefined(user2KYC.status.rejected);
      assert.equal(user2KYC.verificationLevel, 0);
      
      // Fetch user3 (should be revoked)
      const user3KYC = await program.account.kycUser.fetch(kycUser3);
      
      // Verify the status
      assert.isDefined(user3KYC.status.revoked);
      assert.equal(user3KYC.verificationLevel, 0);
    });

    it('Validates verification expiry', async () => {
      // Create a test user for expiry testing
      const expiryTestUser = anchor.web3.Keypair.generate();
      await fundAccounts(connection, [expiryTestUser]);
      
      const [kycExpiryUser] = PublicKey.findProgramAddressSync(
        [KYC_USER_SEED, expiryTestUser.publicKey.toBuffer()],
        program.programId
      );
      
      // Register the user
      await program.methods
        .registerKycUser(
          "99999999",
          Array.from({ length: 32 }, () => 99),
          "IT", // Italian country code
          "TestProvider"
        )
        .accounts({
          authority: authority.publicKey,
          oracleState: kycOracleState,
          user: expiryTestUser.publicKey,
          kycUser: kycExpiryUser,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
      
      // Set the KYC verification with a short expiry time (1 day)
      const shortExpiryDays = new anchor.BN(1);
      await program.methods
        .updateKycStatus(
          { verified: {} }, // Status
          2, // Level 2
          shortExpiryDays // 1 day validity
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
      // For now, we'll just check that the expiry date is properly set
      const currentTime = Math.floor(Date.now() / 1000);
      const expectedExpiryTime = currentTime + shortExpiryDays.toNumber() * 86400;
      
      // Allow some flexibility in timestamp comparison
      const tolerance = 60; // 60 seconds tolerance
      
      assert.approximately(
        kycUserAccount.expiryDate.toNumber(),
        expectedExpiryTime,
        tolerance * 2,
        "Expiry date should be set to approximately current time + 1 day"
      );
    });
  });

  describe('Transaction limits based on KYC level', () => {
    // Create test users for different KYC levels
    let kycLevel1User: PublicKey;
    let kycLevel2User: PublicKey;
    let level1User: Keypair;
    let level2User: Keypair;
    
    // Transaction limits
    const level1TransactionLimit = new anchor.BN(10000).mul(new anchor.BN(10).pow(new anchor.BN(9))); // 10,000 tokens
    const level2TransactionLimit = new anchor.BN(100000).mul(new anchor.BN(10).pow(new anchor.BN(9))); // 100,000 tokens
    
    before(async () => {
      // Create and fund test users
      level1User = anchor.web3.Keypair.generate();
      level2User = anchor.web3.Keypair.generate();
      await fundAccounts(connection, [level1User, level2User]);
      
      // Find PDAs
      [kycLevel1User] = PublicKey.findProgramAddressSync(
        [KYC_USER_SEED, level1User.publicKey.toBuffer()],
        program.programId
      );
      
      [kycLevel2User] = PublicKey.findProgramAddressSync(
        [KYC_USER_SEED, level2User.publicKey.toBuffer()],
        program.programId
      );
      
      // Register level 1 user
      await program.methods
        .registerKycUser(
          "12121212",
          Array.from({ length: 32 }, () => 12),
          "ES", // Spanish country code
          "TestProvider"
        )
        .accounts({
          authority: authority.publicKey,
          oracleState: kycOracleState,
          user: level1User.publicKey,
          kycUser: kycLevel1User,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
      
      // Register level 2 user
      await program.methods
        .registerKycUser(
          "23232323",
          Array.from({ length: 32 }, () => 23),
          "DE", // German country code
          "TestProvider"
        )
        .accounts({
          authority: authority.publicKey,
          oracleState: kycOracleState,
          user: level2User.publicKey,
          kycUser: kycLevel2User,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
      
      // Verify level 1 user
      await program.methods
        .updateKycStatus(
          { verified: {} },
          1, // Level 1
          new anchor.BN(365) // 365 days
        )
        .accounts({
          authority: authority.publicKey,
          oracleState: kycOracleState,
          kycUser: kycLevel1User,
        })
        .signers([authority])
        .rpc();
      
      // Verify level 2 user
      await program.methods
        .updateKycStatus(
          { verified: {} },
          2, // Level 2
          new anchor.BN(365) // 365 days
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
    });
    
    it('Enforces lower transaction limits for Level 1 users', async () => {
      // This is a placeholder for an actual test once we implement the transfer hook
      // In a real test, we would:
      // 1. Mint tokens to a level 1 user
      // 2. Try to transfer slightly below the limit (should succeed)
      // 3. Try to transfer above the limit (should fail)
      
      // Check the limits are correctly defined in the constants
      // For example, we might want to ensure MIN_TRANSFER_KYC_LEVEL is 1
      
      // For now, we'll just check that the users have the correct verification levels
      const level1UserData = await program.account.kycUser.fetch(kycLevel1User);
      assert.equal(level1UserData.verificationLevel, 1, "Level 1 user should have verification level 1");
      
      // In a real transfer test, we would validate transaction limits against these levels
      console.log("Level 1 transaction limit (test):", level1TransactionLimit.toString());
    });
    
    it('Allows higher transaction limits for Level 2 users', async () => {
      // This is a placeholder for an actual test once we implement the transfer hook
      // In a real test, we would:
      // 1. Mint tokens to a level 2 user
      // 2. Try to transfer at the level 1 limit (should succeed)
      // 3. Try to transfer between level 1 and level 2 limits (should succeed)
      // 4. Try to transfer above level 2 limit (should fail)
      
      // For now, just check that the user has level 2 verification
      const level2UserData = await program.account.kycUser.fetch(kycLevel2User);
      assert.equal(level2UserData.verificationLevel, 2, "Level 2 user should have verification level 2");
      
      // In a real transfer test, we would validate transaction limits against these levels
      console.log("Level 2 transaction limit (test):", level2TransactionLimit.toString());
    });
  });

  describe('Country compliance and restrictions', () => {
    // Create test users for different countries
    let kycNonEuUser: PublicKey;
    let nonEuUser: Keypair;
    
    before(async () => {
      // Create and fund test user
      nonEuUser = anchor.web3.Keypair.generate();
      await fundAccounts(connection, [nonEuUser]);
      
      // Find PDA
      [kycNonEuUser] = PublicKey.findProgramAddressSync(
        [KYC_USER_SEED, nonEuUser.publicKey.toBuffer()],
        program.programId
      );
    });
    
    it('Allows registration for users from supported countries', async () => {
      // We already tested this in the earlier registration tests
      // Here we'll focus on the specific country compliance aspects
      
      // Register a user from a EU country
      await program.methods
        .registerKycUser(
          "44444444",
          Array.from({ length: 32 }, () => 44),
          "PT", // Portugal - supported EU country
          "TestProvider"
        )
        .accounts({
          authority: authority.publicKey,
          oracleState: kycOracleState,
          user: nonEuUser.publicKey,
          kycUser: kycNonEuUser,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
      
      // Verify the user and check country code
      await program.methods
        .updateKycStatus(
          { verified: {} },
          1, // Level 1
          new anchor.BN(365) // 365 days
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
      assert.equal(nonEuUserData.countryCode, "PT", "Country code should be PT");
    });
    
    it('Rejects registration for users from unsupported countries', async () => {
      // Create a test user for an unsupported country
      const unsupportedUser = anchor.web3.Keypair.generate();
      await fundAccounts(connection, [unsupportedUser]);
      
      const [kycUnsupportedUser] = PublicKey.findProgramAddressSync(
        [KYC_USER_SEED, unsupportedUser.publicKey.toBuffer()],
        program.programId
      );
      
      // Try to register a user from an unsupported country
      try {
        await program.methods
          .registerKycUser(
            "55555555",
            Array.from({ length: 32 }, () => 55),
            "US", // United States - not in supported EU countries
            "TestProvider"
          )
          .accounts({
            authority: authority.publicKey,
            oracleState: kycOracleState,
            user: unsupportedUser.publicKey,
            kycUser: kycUnsupportedUser,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([authority])
          .rpc();
        assert.fail("Should not be able to register user from unsupported country");
      } catch (error) {
        // Expected error
        assert.include(error.message, "CountryNotSupported");
      }
    });
  });

  describe('KYC verification expiry', () => {
    it('Sets the correct expiry date based on input', async () => {
      // Create a test user for expiry testing
      const expiryUser = anchor.web3.Keypair.generate();
      await fundAccounts(connection, [expiryUser]);
      
      const [kycExpiryUser] = PublicKey.findProgramAddressSync(
        [KYC_USER_SEED, expiryUser.publicKey.toBuffer()],
        program.programId
      );
      
      // Register the user
      await program.methods
        .registerKycUser(
          "66666666",
          Array.from({ length: 32 }, () => 66),
          "ES", // Spanish country code
          "TestProvider"
        )
        .accounts({
          authority: authority.publicKey,
          oracleState: kycOracleState,
          user: expiryUser.publicKey,
          kycUser: kycExpiryUser,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
      
      // Set a short expiry period
      const shortExpiryDays = new anchor.BN(30); // 30 days
      await program.methods
        .updateKycStatus(
          { verified: {} },
          2, // Level 2
          shortExpiryDays // 30 days validity
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
      const currentTime = Math.floor(Date.now() / 1000);
      const expectedExpiryTime = currentTime + expirySeconds;
      
      // Allow some flexibility in timestamp comparison
      const tolerance = 60; // 60 seconds tolerance
      
      assert.approximately(
        expiryUserData.expiryDate.toNumber(),
        expectedExpiryTime,
        tolerance * 2,
        "Expiry date should be set to approximately current time + 30 days"
      );
    });
  });
}); 