/**
 * Tests for AML Authority Functionality
 *
 * These tests verify that the program correctly handles AML (Anti-Money Laundering)
 * authorities, alerts, and actions to ensure regulatory compliance.
 */

import { assert } from "chai";
import { PublicKey, Keypair } from "@solana/web3.js";
import { setupTestContext } from "../framework/setup";
import { TestContext, AmlAuthorityPower } from "../framework/types";
import {
  registerAmlAuthority,
  updateAmlAuthority,
  removeAmlAuthority,
  getAmlAuthority,
  listAmlAuthorities,
  createAmlAlert,
  updateAmlAlert,
  getAmlAlert,
  listAmlAlerts,
  listAmlAlertsForUser,
  takeAmlAction,
} from "../framework/aml-authority-helpers";

describe("AML Authority Functionality", () => {
  let context: TestContext;
  let userKeypair: Keypair;
  let userPublicKey: PublicKey;

  // Set up the test context once for all tests
  before(async () => {
    context = await setupTestContext();

    // Create a test user
    userKeypair = Keypair.generate();
    userPublicKey = userKeypair.publicKey;
  });

  describe("AML Authority Management", () => {
    const testAuthorityId = "EU-FINANCIAL-INTELLIGENCE-UNIT";

    it("should register a new AML authority", async () => {
      // Register a new AML authority - don't need to store the return value
      await registerAmlAuthority(context, {
        authorityId: testAuthorityId,
        name: "EU Financial Intelligence Unit",
        institution: "European Union",
        jurisdiction: "EU",
        contactEmail: "contact@eu-fiu.example.com",
        powers: [
          AmlAuthorityPower.ViewTransactions,
          AmlAuthorityPower.FreezeAccounts,
          AmlAuthorityPower.RequestUserInfo,
        ],
      });

      // Verify the authority exists
      const authority = await getAmlAuthority(context, testAuthorityId);
      assert.isDefined(authority);
      assert.equal(authority.name, "EU Financial Intelligence Unit");
      assert.equal(authority.institution, "European Union");
      assert.equal(authority.jurisdiction, "EU");
      assert.equal(authority.contactEmail, "contact@eu-fiu.example.com");
      assert.isTrue(
        authority.powers.includes(AmlAuthorityPower.ViewTransactions)
      );
      assert.isTrue(
        authority.powers.includes(AmlAuthorityPower.FreezeAccounts)
      );
      assert.isTrue(
        authority.powers.includes(AmlAuthorityPower.RequestUserInfo)
      );
      assert.isTrue(authority.active);
    });

    it("should update an existing AML authority", async () => {
      // Update the AML authority
      await updateAmlAuthority(context, {
        authorityId: testAuthorityId,
        name: "Updated EU Financial Intelligence Unit",
        contactEmail: "new-contact@eu-fiu.example.com",
        powers: [
          AmlAuthorityPower.ViewTransactions,
          AmlAuthorityPower.RequestUserInfo,
        ],
        active: true,
      });

      // Verify the update
      const authority = await getAmlAuthority(context, testAuthorityId);
      assert.equal(authority.name, "Updated EU Financial Intelligence Unit");
      assert.equal(authority.contactEmail, "new-contact@eu-fiu.example.com");
      assert.isTrue(
        authority.powers.includes(AmlAuthorityPower.ViewTransactions)
      );
      assert.isTrue(
        authority.powers.includes(AmlAuthorityPower.RequestUserInfo)
      );
      assert.isFalse(
        authority.powers.includes(AmlAuthorityPower.FreezeAccounts)
      );
    });

    it("should deactivate an AML authority", async () => {
      // Deactivate the authority
      await updateAmlAuthority(context, {
        authorityId: testAuthorityId,
        active: false,
      });

      // Verify the deactivation
      const authority = await getAmlAuthority(context, testAuthorityId);
      assert.isFalse(authority.active);
    });

    it("should list all AML authorities", async () => {
      // Register a second authority for this test
      const secondAuthorityId = "US-FINCEN";
      await registerAmlAuthority(context, {
        authorityId: secondAuthorityId,
        name: "US Financial Crimes Enforcement Network",
        institution: "U.S. Department of Treasury",
        jurisdiction: "US",
        contactEmail: "contact@fincen.example.com",
        powers: [
          AmlAuthorityPower.ViewTransactions,
          AmlAuthorityPower.RequestUserInfo,
        ],
      });

      // List all authorities
      const authorities = await listAmlAuthorities(context);

      // Should have at least 2 authorities
      assert.isAtLeast(authorities.length, 2);

      // Verify both authorities are in the list
      const euAuthority = authorities.find(
        (a) => a.authorityId === testAuthorityId
      );
      const usAuthority = authorities.find(
        (a) => a.authorityId === secondAuthorityId
      );
      assert.isDefined(euAuthority);
      assert.isDefined(usAuthority);
    });

    it("should remove an AML authority", async () => {
      // Remove the second authority we added
      await removeAmlAuthority(context, "US-FINCEN");

      // Verify it's gone
      try {
        await getAmlAuthority(context, "US-FINCEN");
        assert.fail("Authority should have been removed");
      } catch (error) {
        // Expected error - authority was removed
      }
    });
  });

  describe("AML Alerts and Actions", () => {
    let alertId: string;
    const authorityId = "TEST-AUTHORITY";

    before(async () => {
      // Register a test authority for these tests
      await registerAmlAuthority(context, {
        authorityId,
        name: "Test AML Authority",
        institution: "Test Institution",
        jurisdiction: "TEST",
        contactEmail: "test@example.com",
        powers: [
          AmlAuthorityPower.ViewTransactions,
          AmlAuthorityPower.FreezeAccounts,
          AmlAuthorityPower.RequestUserInfo,
        ],
      });
    });

    it("should create a new AML alert", async () => {
      // Create an alert, don't need to store the return value
      alertId = `ALERT-${Date.now()}`;
      await createAmlAlert(context, {
        alertId,
        authorityId,
        userPublicKey,
        severity: 2,
        description: "Suspicious transaction pattern detected",
        transactionIds: ["tx123", "tx456"],
        status: "OPEN",
      });

      // Verify the alert exists
      const alert = await getAmlAlert(context, alertId);
      assert.isDefined(alert);
      assert.equal(alert.alertId, alertId);
      assert.equal(alert.authorityId, authorityId);
      assert.isTrue(alert.user.equals(userPublicKey));
      assert.equal(alert.severity, 2);
      assert.equal(
        alert.description,
        "Suspicious transaction pattern detected"
      );
      assert.deepEqual(alert.transactionIds, ["tx123", "tx456"]);
      assert.equal(alert.status, "OPEN");
      assert.isNull(alert.actionTaken);
      assert.isNull(alert.resolution);
    });

    it("should update an existing AML alert", async () => {
      // Update the alert
      await updateAmlAlert(context, {
        alertId,
        severity: 3,
        description: "Updated: High-risk transaction pattern confirmed",
        status: "ESCALATED",
      });

      // Verify the update
      const alert = await getAmlAlert(context, alertId);
      assert.equal(alert.severity, 3);
      assert.equal(
        alert.description,
        "Updated: High-risk transaction pattern confirmed"
      );
      assert.equal(alert.status, "ESCALATED");
    });

    it("should take action on an AML alert", async () => {
      // Take action on the alert
      await takeAmlAction(context, {
        alertId,
        action: "FREEZE_ACCOUNT",
        justification:
          "High risk activity requires immediate preventive measures",
        resolution: "PENDING_INVESTIGATION",
      });

      // Verify the action was recorded
      const alert = await getAmlAlert(context, alertId);
      assert.equal(alert.actionTaken, "FREEZE_ACCOUNT");
      assert.equal(alert.resolution, "PENDING_INVESTIGATION");
      assert.equal(alert.status, "ACTION_TAKEN");
    });

    it("should list all AML alerts", async () => {
      // Create a second alert for this test
      const secondAlertId = `ALERT-${Date.now()}-2`;
      await createAmlAlert(context, {
        alertId: secondAlertId,
        authorityId,
        userPublicKey,
        severity: 1,
        description: "Minor irregularity detected",
        transactionIds: ["tx789"],
        status: "OPEN",
      });

      // List all alerts
      const alerts = await listAmlAlerts(context);

      // Should have at least 2 alerts
      assert.isAtLeast(alerts.length, 2);

      // Verify both alerts are in the list
      const firstAlert = alerts.find((a) => a.alertId === alertId);
      const secondAlert = alerts.find((a) => a.alertId === secondAlertId);
      assert.isDefined(firstAlert);
      assert.isDefined(secondAlert);
    });

    it("should list all AML alerts for a specific user", async () => {
      // Create an alert for a different user
      const differentUserKeypair = Keypair.generate();
      const differentUserAlertId = `ALERT-${Date.now()}-diff-user`;

      await createAmlAlert(context, {
        alertId: differentUserAlertId,
        authorityId,
        userPublicKey: differentUserKeypair.publicKey,
        severity: 1,
        description: "Alert for different user",
        transactionIds: ["tx999"],
        status: "OPEN",
      });

      // List alerts for our original test user
      const userAlerts = await listAmlAlertsForUser(context, userPublicKey);

      // Verify we get only alerts for our test user
      assert.isAtLeast(userAlerts.length, 2);
      userAlerts.forEach((alert) => {
        assert.isTrue(alert.user.equals(userPublicKey));
      });

      // The alert for the different user should not be in this list
      const differentUserAlert = userAlerts.find(
        (a) => a.alertId === differentUserAlertId
      );
      assert.isUndefined(differentUserAlert);
    });
  });
});
