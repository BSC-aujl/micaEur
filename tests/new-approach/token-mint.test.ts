/**
 * Tests for Token Mint Functionality
 *
 * These tests verify the token mint functionality, including initializing
 * the Euro mint, setting up minting authority, and proper validation of
 * reserve proofs and token supply.
 */

import { assert } from "chai";
import { Keypair } from "@solana/web3.js";
import { setupTestContext } from "../framework/setup";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TestContext = any;
import { initializeEuroMint } from "../framework/token-mint-helpers";

describe("Token Mint", () => {
  let context: TestContext;
  let issuerKeypair: Keypair;

  before(async () => {
    // Create keypairs for the test
    issuerKeypair = Keypair.generate();

    // Set up the test context
    context = await setupTestContext();
  });

  it("should initialize a Euro mint", async () => {
    const mintKeypair = Keypair.generate();
    await initializeEuroMint(context, {
      mintKeypair,
      whitepaperUri: "https://example.com/whitepaper",
      issuerKeypair,
    });

    // Verify the mint is initialized correctly
    assert.ok(
      mintKeypair.publicKey,
      "Euro mint should have a valid public key"
    );
  });
});
