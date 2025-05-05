import { assert } from "chai";
import { PublicKey } from "@solana/web3.js";
import { setupTestContext } from "../framework/setup";
import { initializeKycOracle } from "../framework/kyc-oracle-helpers";

/**
 * Smoke test suite for CI/CD
 *
 * This test suite is designed to be fast and reliable for CI/CD.
 * It tests the most basic functionality to ensure the program is working.
 */
describe("Smoke Tests", () => {
  let context: Awaited<ReturnType<typeof setupTestContext>>;

  // Set up the test context once for all tests
  before(async () => {
    context = await setupTestContext();
  });

  describe("Program Connection", () => {
    it("should connect to the program", async () => {
      assert.isDefined(context.program);
      assert.isDefined(context.program.programId);
      assert.instanceOf(context.program.programId, PublicKey);
    });

    it("should have a valid provider", async () => {
      assert.isDefined(context.provider);
      assert.isDefined(context.provider.connection);
    });
  });

  describe("KYC Oracle", () => {
    let oracleStatePDA: PublicKey;

    it("should initialize the KYC Oracle", async () => {
      // Initialize the KYC Oracle
      oracleStatePDA = await initializeKycOracle(context);

      // Verify the Oracle was initialized
      assert.isDefined(oracleStatePDA);

      // Fetch and verify the KYC Oracle state
      const oracleState = await context.program.account.kycOracleState.fetch(
        oracleStatePDA
      );

      assert.isTrue(oracleState.isActive);
      assert.equal(
        oracleState.authority.toString(),
        context.keypairs.authority.publicKey.toString()
      );
    });
  });
});
