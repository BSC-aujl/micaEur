/**
 * Tests for Blacklisting Functionality
 *
 * These tests verify that the program correctly handles blacklisting users
 * with revoked KYC or suspicious activities.
 */

import { assert } from "chai";
import { PublicKey, Keypair } from "@solana/web3.js";
import { setupTestContext } from "../framework/setup";
import {
  TestContext,
  BlacklistReason,
  BlacklistActionType,
} from "../framework/types";
import {
  addToBlacklist,
  updateBlacklistEntry,
  removeFromBlacklist,
  getBlacklistEntry,
  isBlacklisted,
  listBlacklistedUsers,
  blacklistOnKycRevocation,
} from "../framework/blacklist-helpers";
import { initializeKycOracle } from "../framework/kyc-oracle-helpers";

describe("Blacklisting Functionality", () => {
  let context: TestContext;
  let userKeypair: Keypair;
  let userPublicKey: PublicKey;
  let userKycPDA: PublicKey;

  // Set up the test context once for all tests
  before(async () => {
    context = await setupTestContext();

    // Initialize the KYC Oracle
    await initializeKycOracle(context);

    // Create a test user with a KYC status
    userKeypair = Keypair.generate();
    userPublicKey = userKeypair.publicKey;

    // Register the user with KYC
    const [pda] = await PublicKey.findProgramAddress(
      [Buffer.from("kyc-user"), userPublicKey.toBuffer()],
      context.program.programId
    );
    userKycPDA = pda;

    // Register and verify the user with KYC (using existing KYC functionality)
    await context.program.methods
      .registerKycUser(
        "12345678", // BLZ
        Array.from(Buffer.from("test-iban-hash".padEnd(32, "0"))), // IBAN hash
        "DE", // Country code
        "TEST-PROVIDER" // Provider
      )
      .accounts({
        kycUser: userKycPDA,
        user: userPublicKey,
        authority: context.keypairs.authority.publicKey,
        systemProgram: PublicKey.default,
      })
      .signers([context.keypairs.authority])
      .rpc();

    // Verify the user
    await context.program.methods
      .updateKycStatus(
        { verified: {} },
        2, // Verification level
        365 // Expiry days
      )
      .accounts({
        kycUser: userKycPDA,
        authority: context.keypairs.authority.publicKey,
      })
      .signers([context.keypairs.authority])
      .rpc();
  });

  describe("Basic Blacklisting Operations", () => {
    it("should add a user to the blacklist", async () => {
      // Add user to blacklist
      await addToBlacklist(context, {
        userPublicKey,
        reason: BlacklistReason.SuspiciousActivity,
        evidence: "Suspicious transaction pattern detected",
        actionType: BlacklistActionType.Freeze,
      });

      // Verify the user is blacklisted
      const isUserBlacklisted = await isBlacklisted(context, userPublicKey);
      assert.isTrue(isUserBlacklisted);

      // Verify the blacklist details
      const entry = await getBlacklistEntry(context, userPublicKey);
      assert.isDefined(entry);
      assert.equal(entry.reason, BlacklistReason.SuspiciousActivity);
      assert.equal(entry.actionType, BlacklistActionType.Freeze);
      assert.equal(entry.evidence, "Suspicious transaction pattern detected");
      assert.isNull(entry.expiryDate);
      assert.isTrue(entry.user.equals(userPublicKey));
    });

    it("should update a blacklist entry", async () => {
      // Update the blacklist entry
      await updateBlacklistEntry(context, {
        userPublicKey,
        reason: BlacklistReason.RegulatoryOrder,
        evidence: "Updated evidence: Regulatory compliance order",
        expiryDate: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60, // 90 days from now
        actionType: BlacklistActionType.Restrict,
      });

      // Verify the update
      const entry = await getBlacklistEntry(context, userPublicKey);
      assert.equal(entry.reason, BlacklistReason.RegulatoryOrder);
      assert.equal(
        entry.evidence,
        "Updated evidence: Regulatory compliance order"
      );
      assert.equal(entry.actionType, BlacklistActionType.Restrict);
      assert.isNotNull(entry.expiryDate);
    });

    it("should remove a user from the blacklist", async () => {
      // Remove from blacklist
      await removeFromBlacklist(context, userPublicKey);

      // Verify the user is no longer blacklisted
      const isUserBlacklisted = await isBlacklisted(context, userPublicKey);
      assert.isFalse(isUserBlacklisted);
    });
  });

  describe("Automatic Blacklisting on KYC Revocation", () => {
    it("should automatically blacklist a user when KYC is revoked", async () => {
      // Create a new user for this test
      const newUserKeypair = Keypair.generate();
      const newUserPublicKey = newUserKeypair.publicKey;

      // Register and verify the user with KYC
      const [newUserKycPDA] = await PublicKey.findProgramAddress(
        [Buffer.from("kyc-user"), newUserPublicKey.toBuffer()],
        context.program.programId
      );

      await context.program.methods
        .registerKycUser(
          "87654321",
          Array.from(Buffer.from("another-iban-hash".padEnd(32, "0"))),
          "DE",
          "TEST-PROVIDER"
        )
        .accounts({
          kycUser: newUserKycPDA,
          user: newUserPublicKey,
          authority: context.keypairs.authority.publicKey,
          systemProgram: PublicKey.default,
        })
        .signers([context.keypairs.authority])
        .rpc();

      await context.program.methods
        .updateKycStatus({ verified: {} }, 2, 365)
        .accounts({
          kycUser: newUserKycPDA,
          authority: context.keypairs.authority.publicKey,
        })
        .signers([context.keypairs.authority])
        .rpc();

      // Now revoke KYC and blacklist in one operation
      await blacklistOnKycRevocation(context, {
        userPublicKey: newUserPublicKey,
        userKycPDA: newUserKycPDA,
        evidence: "KYC verification issues discovered",
        actionType: BlacklistActionType.Freeze,
      });

      // Verify the user is blacklisted
      const isUserBlacklisted = await isBlacklisted(context, newUserPublicKey);
      assert.isTrue(isUserBlacklisted);

      // Verify the blacklist details
      const entry = await getBlacklistEntry(context, newUserPublicKey);
      assert.equal(entry.reason, BlacklistReason.KycRevoked);

      // Verify the KYC status is now rejected
      const kycStatus = await context.program.account.kycUser.fetch(
        newUserKycPDA
      );
      assert.isTrue("rejected" in kycStatus.status);
      assert.equal(kycStatus.verificationLevel, 0);
    });

    it("should list all blacklisted users", async () => {
      // Add another user to the blacklist for this test
      const anotherUserKeypair = Keypair.generate();
      await addToBlacklist(context, {
        userPublicKey: anotherUserKeypair.publicKey,
        reason: BlacklistReason.SuspiciousActivity,
        evidence: "Test evidence",
        actionType: BlacklistActionType.Freeze,
      });

      // List all blacklisted users
      const blacklistedUsers = await listBlacklistedUsers(context);

      // Should have at least 2 users in the blacklist
      assert.isAtLeast(blacklistedUsers.length, 2);
    });
  });
});
