/**
 * Smoke Test
 * 
 * This test is used to verify the basic setup is working correctly
 * and can run without a validator connection in CI or pre-commit hooks.
 */

import { setupMockTestContext } from "../utils/mock-setup";
import { assert } from "chai";
import { PublicKey } from "@solana/web3.js";

describe("Smoke Test", () => {
  it("should set up a mock test context", async () => {
    const context = setupMockTestContext();
    
    // Verify the context has the expected properties
    assert.isDefined(context.program, "Program should be defined");
    assert.isDefined(context.connection, "Connection should be defined");
    assert.isDefined(context.keypairs, "Keypairs should be defined");
    assert.isDefined(context.accounts, "Accounts should be defined");
    
    // Verify we have the expected keypairs
    assert.isDefined(context.keypairs.authority, "Authority keypair should exist");
    assert.isDefined(context.keypairs.user1, "User1 keypair should exist");
    assert.isDefined(context.keypairs.user2, "User2 keypair should exist");
    assert.isDefined(context.keypairs.user3, "User3 keypair should exist");
    
    // Verify the accounts exist
    assert.isDefined(context.accounts.kycOracle, "KYC Oracle account should exist");
    assert.isDefined(context.accounts.kycUser1, "KYC User1 account should exist");
    assert.isDefined(context.accounts.kycUser2, "KYC User2 account should exist");
    
    // Verify the program ID is a PublicKey
    assert.isTrue(context.program.programId instanceof PublicKey, "Program ID should be a PublicKey");
  });
  
  it("should be able to call mock program methods", async () => {
    const context = setupMockTestContext();
    
    // Test calling a program method
    const result = await context.program.methods
      .initializeKycOracle()
      .accounts({})
      .signers([])
      .rpc();
    
    assert.equal(result, "mock_signature", "Should return a mock signature");
  });
});
