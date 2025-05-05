/**
 * Tests for Complete KYC/AML Compliance Flow
 *
 * These tests verify the end-to-end compliance system for the MiCA EUR stablecoin,
 * including KYC verification, AML monitoring, blacklisting, and regulatory actions.
 */

import { assert } from "chai";
import { PublicKey, Keypair } from "@solana/web3.js";
import { setupTestContext } from "../utils/setup";
import {
  BlacklistReason,
  AmlPower,
  KycVerificationLevel,
} from "../utils/types";
import {
  initializeKycOracle,
  registerKycUser,
  updateKycStatus,
} from "../utils/kyc-oracle-helpers";
import {
  registerKycProvider,
  processThirdPartyVerification,
  signVerificationData,
} from "../utils/kyc-provider-helpers";
import { getBlacklistEntry, isBlacklisted } from "../utils/blacklist-helpers";
import {
  registerAmlAuthority,
  createAmlAlert,
  updateAmlAlert,
  takeAmlAction,
} from "../utils/aml-authority-helpers";
import {
  createMicaEurMint,
  mintTokensToRecipients,
  isRedemptionAllowed,
} from "../utils/token-mint-helpers";

describe("Complete KYC/AML Compliance Flow", () => {
  // There is a type mismatch between TestContext in utils/types.ts and utils/setup.ts
  // We use any to avoid these type conflicts until they can be properly resolved
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let context: any;

  // Key participants
  let userKeypair: Keypair;
  let businessKeypair: Keypair;
  let suspiciousUserKeypair: Keypair;
  let providerKeypair: Keypair;
  let authorityKeypair: Keypair;

  // Token related
  let tokenMint: PublicKey;
  let issuerKeypair: Keypair;

  // KYC PDAs
  let userKycPDA: PublicKey;

  before(async () => {
    // Set up the test context
    context = await setupTestContext();

    // Set up keypairs
    userKeypair = Keypair.generate();
    businessKeypair = Keypair.generate();
    suspiciousUserKeypair = Keypair.generate();
    providerKeypair = Keypair.generate();
    authorityKeypair = context.keypairs.authority;
    issuerKeypair = context.keypairs.mint || Keypair.generate();

    // Initialize the KYC Oracle
    await initializeKycOracle(context);

    // Initialize token mint
    tokenMint = await createMicaEurMint(context, {
      issuer: issuerKeypair.publicKey,
      freezeAuthority: authorityKeypair.publicKey,
      permanentDelegate: authorityKeypair.publicKey,
      whitePaperUri: "https://example.com/whitepaper.pdf",
    });

    // Register KYC provider
    await registerKycProvider(context, {
      name: "Test KYC Provider",
      jurisdiction: "Global",
      providerKeypair,
    });

    // Register AML authority
    await registerAmlAuthority(context, {
      institution: "Financial Intelligence Unit",
      jurisdiction: "EU",
      powers: [AmlPower.Monitor, AmlPower.Freeze, AmlPower.Seize],
      authorityKeypair,
    });
  });

  describe("User Onboarding and Compliance", () => {
    it("should register and verify a regular user with KYC", async () => {
      // Register new KYC user
      userKycPDA = await registerKycUser(context, {
        userKeypair,
        blz: "12345678",
        ibanHash: "DE89370400440532013000",
        countryCode: 49,
        verificationProvider: "TEST-PROVIDER",
        verificationLevel: KycVerificationLevel.User,
      });

      // Verify KYC
      await updateKycStatus(context, {
        kycUserPDA: userKycPDA,
        status: { verified: {} },
        verificationLevel: KycVerificationLevel.User,
        expiryDays: 365,
      });

      // Check user can use the token
      const canRedeem = await isRedemptionAllowed(
        context,
        userKeypair.publicKey
      );
      assert.isTrue(canRedeem, "Verified user should be able to redeem tokens");
    });

    it("should register and verify a business entity with enhanced KYC", async () => {
      // Register new business KYC
      const businessKycPDA = await registerKycUser(context, {
        userKeypair: businessKeypair,
        blz: "87654321",
        ibanHash: "DE89370400440532013001",
        countryCode: 49,
        verificationProvider: "TEST-PROVIDER",
        verificationLevel: KycVerificationLevel.Business,
      });

      // Verify KYC with business level
      await updateKycStatus(context, {
        kycUserPDA: businessKycPDA,
        status: { verified: {} },
        verificationLevel: KycVerificationLevel.Business,
        expiryDays: 365,
      });

      // Check business can use the token
      const canRedeem = await isRedemptionAllowed(
        context,
        businessKeypair.publicKey
      );
      assert.isTrue(
        canRedeem,
        "Verified business should be able to redeem tokens"
      );
    });

    it("should detect and flag suspicious activity", async () => {
      // Register suspicious user with minimal KYC
      const suspiciousUserKycPDA = await registerKycUser(context, {
        userKeypair: suspiciousUserKeypair,
        blz: "11223344",
        ibanHash: "DE89370400440532013002",
        countryCode: 49,
        verificationProvider: "TEST-PROVIDER",
        verificationLevel: KycVerificationLevel.User,
      });

      // Initially verify the user (will be flagged later)
      await updateKycStatus(context, {
        kycUserPDA: suspiciousUserKycPDA,
        status: { verified: {} },
        verificationLevel: KycVerificationLevel.User,
        expiryDays: 365,
      });

      // Create an AML alert for suspicious activity
      const alertId = await createAmlAlert(context, {
        userPublicKey: suspiciousUserKeypair.publicKey,
        alertType: 1,
        description: "Structured transactions detected",
        evidence: ["tx1", "tx2", "tx3"],
        authorityKeypair,
      });

      // Escalate the alert
      await updateAmlAlert(context, {
        alertId,
        status: "INVESTIGATING",
        authorityKeypair,
      });

      // Take AML action (blacklist)
      await takeAmlAction(context, {
        alertId,
        authorityKeypair,
        userPublicKey: suspiciousUserKeypair.publicKey,
        blacklistReason: BlacklistReason.SuspiciousActivity,
        evidence: "Structured transactions",
      });

      // Verify user is blacklisted
      const isUserBlacklisted = await isBlacklisted(
        context,
        suspiciousUserKeypair.publicKey
      );
      assert.isTrue(isUserBlacklisted, "Suspicious user should be blacklisted");

      // Verify blacklist reason
      const blacklistEntry = await getBlacklistEntry(
        context,
        suspiciousUserKeypair.publicKey
      );
      assert.equal(blacklistEntry.reason, BlacklistReason.SuspiciousActivity);
    });
  });

  describe("Third-Party KYC Integration", () => {
    let newUserKeypair: Keypair;

    before(() => {
      newUserKeypair = Keypair.generate();
    });

    it("should verify a user through a third-party KYC provider", async () => {
      // Create verification data
      const verificationId = `VERIF-${Date.now()}`;
      const verificationData = JSON.stringify({
        userId: newUserKeypair.publicKey.toBase58(),
        fullName: "Test User",
        dateOfBirth: "1990-01-01",
        nationality: "DE",
        verificationLevel: KycVerificationLevel.User,
      });

      // Sign the verification data
      const signature = signVerificationData(providerKeypair, verificationData);

      // Process the verification
      await processThirdPartyVerification(context, {
        userKeypair: newUserKeypair,
        providerId: "TEST-PROVIDER",
        verificationId,
        verificationData,
        verificationLevel: KycVerificationLevel.User,
        expiryDays: 365,
        signature,
      });

      // Check the user is verified
      const canRedeem = await isRedemptionAllowed(
        context,
        newUserKeypair.publicKey
      );
      assert.isTrue(
        canRedeem,
        "User verified by third-party should be able to redeem tokens"
      );
    });
  });

  describe("Regulatory Action Simulation", () => {
    let regulatedUserKeypair: Keypair;

    before(async () => {
      regulatedUserKeypair = Keypair.generate();

      // Register the user
      const regulatedUserKycPDA = await registerKycUser(context, {
        userKeypair: regulatedUserKeypair,
        blz: "55667788",
        ibanHash: "DE89370400440532013003",
        countryCode: 49,
        verificationProvider: "TEST-PROVIDER",
        verificationLevel: KycVerificationLevel.User,
      });

      // Verify the user
      await updateKycStatus(context, {
        kycUserPDA: regulatedUserKycPDA,
        status: { verified: {} },
        verificationLevel: KycVerificationLevel.User,
        expiryDays: 365,
      });
    });

    it("should enforce a regulatory order through the AML system", async () => {
      // Create an AML alert based on regulatory notice
      const alertId = `REG-${Date.now()}`;

      await createAmlAlert(context, {
        userPublicKey: regulatedUserKeypair.publicKey,
        alertType: 2,
        description: "Regulatory compliance order received",
        evidence: ["order-123"],
        authorityKeypair,
      });

      // Apply regulatory action
      await takeAmlAction(context, {
        alertId,
        authorityKeypair,
        userPublicKey: regulatedUserKeypair.publicKey,
        blacklistReason: BlacklistReason.RegulatoryOrder,
        evidence: "Compliance with regulatory order 123",
      });

      // Verify user is blacklisted
      const isUserBlacklisted = await isBlacklisted(
        context,
        regulatedUserKeypair.publicKey
      );
      assert.isTrue(
        isUserBlacklisted,
        "User should be blacklisted due to regulatory order"
      );

      const blacklistEntry = await getBlacklistEntry(
        context,
        regulatedUserKeypair.publicKey
      );
      assert.equal(blacklistEntry.reason, BlacklistReason.RegulatoryOrder);
    });
  });

  describe("End-to-End Token Operation with Compliance", () => {
    it("should demonstrate a complete KYC -> token issuance -> monitoring flow", async () => {
      // Create a new compliant user
      const compliantUserKeypair = Keypair.generate();

      // Register and verify KYC
      const compliantUserKycPDA = await registerKycUser(context, {
        userKeypair: compliantUserKeypair,
        blz: "99887766",
        ibanHash: "DE89370400440532013004",
        countryCode: 49,
        verificationProvider: "TEST-PROVIDER",
        verificationLevel: KycVerificationLevel.User,
      });

      await updateKycStatus(context, {
        kycUserPDA: compliantUserKycPDA,
        status: { verified: {} },
        verificationLevel: KycVerificationLevel.User,
        expiryDays: 365,
      });

      // Mint tokens to the user
      await mintTokensToRecipients(context, {
        mint: tokenMint,
        authority: issuerKeypair,
        recipients: [
          {
            recipient: compliantUserKeypair.publicKey,
            amount: 1000,
          },
        ],
      });

      // Create a low-severity AML alert for monitoring
      const alertId = `MON-${Date.now()}`;
      await createAmlAlert(context, {
        userPublicKey: compliantUserKeypair.publicKey,
        alertType: 0,
        description: "Routine transaction monitoring",
        evidence: ["tx-a", "tx-b"],
        authorityKeypair,
      });

      // Update the alert to close it as false positive
      await updateAmlAlert(context, {
        alertId,
        status: "CLOSED",
        description: "Reviewed and found compliant",
        resolutionNotes: "False positive - normal business activity",
        authorityKeypair,
      });

      // User should not be blacklisted
      const isUserBlacklisted = await isBlacklisted(
        context,
        compliantUserKeypair.publicKey
      );
      assert.isFalse(
        isUserBlacklisted,
        "Compliant user should not be blacklisted"
      );

      // User should still be able to redeem
      const canRedeem = await isRedemptionAllowed(
        context,
        compliantUserKeypair.publicKey
      );
      assert.isTrue(
        canRedeem,
        "Compliant user should be able to redeem tokens"
      );
    });
  });

  describe("Third-Party Verification", () => {
    let regulatedUserKeypair: Keypair;
    let regulatedUserKycPDA: PublicKey;

    before(async () => {
      // Create a new keypair for regulated user
      regulatedUserKeypair = Keypair.generate();

      // Register the user with KYC, but no verification yet
      regulatedUserKycPDA = await registerKycUser(context, {
        userKeypair: regulatedUserKeypair,
        blz: "11234567",
        ibanHash: "DE89370400440532013003",
        countryCode: 49,
        verificationProvider: "TEST-PROVIDER",
        verificationLevel: KycVerificationLevel.None,
      });
    });

    it("should complete KYC through third-party verification", async () => {
      // Create verification data
      const verificationData = JSON.stringify({
        user: regulatedUserKeypair.publicKey.toBase58(),
        level: KycVerificationLevel.User,
        timestamp: Date.now(),
        provider: "TEST-PROVIDER",
      });

      // Sign with provider key
      const signature = signVerificationData(providerKeypair, verificationData);

      // Process third-party verification
      await processThirdPartyVerification(context, {
        userKeypair: regulatedUserKeypair,
        providerId: "TEST-PROVIDER",
        verificationId: "verification-test-1",
        verificationData,
        verificationLevel: KycVerificationLevel.User,
        expiryDays: 365,
        signature,
      });

      // Verify the user
      await updateKycStatus(context, {
        kycUserPDA: regulatedUserKycPDA,
        status: { verified: {} },
        verificationLevel: KycVerificationLevel.User,
        expiryDays: 365,
      });
    });
  });
});
