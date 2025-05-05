import { assert } from "chai";
import { PublicKey } from "@solana/web3.js";
import { setupTestContext } from "../utils/setup";
import {
  initializeKycOracle,
  registerKycUser,
  updateKycStatus,
  fetchKycUser,
  isKycVerified,
  findKycUserPDA,
} from "../utils/kyc-oracle-helpers";

describe("KYC Oracle", () => {
  // This is our test context with program, wallet, etc.
  let context: Awaited<ReturnType<typeof setupTestContext>>;

  // Test data
  const blz1 = "10070000"; // Deutsche Bank BLZ
  const blz2 = "37040044"; // Commerzbank BLZ
  const ibanHash1 = Array.from(
    Buffer.from("DE89370400440532013000".padEnd(32, "0"))
  );
  const ibanHash2 = Array.from(
    Buffer.from("DE27100777770209299700".padEnd(32, "0"))
  );

  // Test account PDAs
  let kycUser1PDA: PublicKey;
  let kycUser2PDA: PublicKey;

  before(async () => {
    // Set up the test context with default config
    context = await setupTestContext();

    // Initialize the KYC Oracle
    await initializeKycOracle(context);
  });

  it("should initialize the KYC Oracle correctly", async () => {
    // Fetch the KYC Oracle state
    const oracleState = await context.program.account.kycOracleState.fetch(
      context.accounts.kycOracleState
    );

    // Verify the state is correct
    assert.isTrue(oracleState.isActive);
    assert.equal(
      oracleState.authority.toString(),
      context.keypairs.authority.publicKey.toString()
    );
    assert.equal(oracleState.adminCount, 1);
    assert.equal(oracleState.totalVerifiedUsers.toString(), "0");
  });

  it("should register a new KYC user", async () => {
    // Register User 1
    kycUser1PDA = await registerKycUser(context, {
      userKeypair: context.keypairs.user1,
      blz: blz1,
      ibanHash: ibanHash1,
      countryCode: "DE",
      verificationProvider: "VERIFF",
    });

    // Fetch and verify the KYC user data
    const user1 = await fetchKycUser(context, kycUser1PDA);

    assert.equal(
      user1.user.toString(),
      context.keypairs.user1.publicKey.toString()
    );
    assert.equal(user1.blz, blz1);
    assert.deepEqual(user1.ibanHash, ibanHash1);
    assert.equal(user1.countryCode, "DE");
    assert.equal(user1.verificationLevel, 0);
    assert.isDefined(user1.status.pending);
  });

  it("should update KYC status for a user", async () => {
    // Update User 1 KYC status to verified
    await updateKycStatus(context, {
      kycUserPDA: kycUser1PDA,
      status: { verified: {} as Record<string, never> },
      verificationLevel: 2,
      expiryDays: 365,
    });

    // Fetch and verify the updated KYC user data
    const user1 = await fetchKycUser(context, kycUser1PDA);

    assert.isDefined(user1.status.verified);
    assert.equal(user1.verificationLevel, 2);

    // Verify the user is considered verified
    assert.isTrue(isKycVerified(user1));
  });

  it("should register and verify multiple users", async () => {
    // Register User 2
    kycUser2PDA = await registerKycUser(context, {
      userKeypair: context.keypairs.user2,
      blz: blz2,
      ibanHash: ibanHash2,
      countryCode: "DE",
      verificationProvider: "VERIFF",
    });

    // Update User 2 KYC status to verified with lower level
    await updateKycStatus(context, {
      kycUserPDA: kycUser2PDA,
      status: { verified: {} as Record<string, never> },
      verificationLevel: 1,
      expiryDays: 180,
    });

    // Fetch both users
    const user1 = await fetchKycUser(context, kycUser1PDA);
    const user2 = await fetchKycUser(context, kycUser2PDA);

    // Verify both are marked as verified
    assert.isDefined(user1.status.verified);
    assert.isDefined(user2.status.verified);

    // Verify different verification levels
    assert.equal(user1.verificationLevel, 2);
    assert.equal(user2.verificationLevel, 1);
  });

  it("should handle KYC expiry correctly", async () => {
    // Find a PDA for a new user
    const [expiredUserPDA] = findKycUserPDA(
      context.keypairs.user3.publicKey,
      context.program.programId
    );

    // Register User 3
    await registerKycUser(context, {
      userKeypair: context.keypairs.user3,
      blz: "12030000", // DKB BLZ
      ibanHash: Array.from(
        Buffer.from("DE23100900001234567890".padEnd(32, "0"))
      ),
      countryCode: "DE",
      verificationProvider: "VERIFF",
    });

    // Set User 3 to verified but with expiry in the past
    await updateKycStatus(context, {
      kycUserPDA: expiredUserPDA,
      status: { verified: {} as Record<string, never> },
      verificationLevel: 1,
      expiryDays: -1, // Expired 1 day ago
    });

    // Fetch the user data
    const expiredUser = await fetchKycUser(context, expiredUserPDA);

    // Verify the status shows as verified in the database
    assert.isDefined(expiredUser.status.verified);

    // But the isKycVerified helper should return false due to expiry
    assert.isFalse(isKycVerified(expiredUser));
  });
});
