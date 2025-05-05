/**
 * Tests for Freeze and Seize Functionality
 *
 * These tests verify that the program correctly handles freezing token accounts
 * and seizing tokens from suspicious accounts.
 */

import { assert } from "chai";
import { Keypair } from "@solana/web3.js";
import { setupTestContext } from "../utils/setup";
import {
  initializeKycOracle,
  registerKycUser,
  updateKycStatus,
} from "../utils/kyc-oracle-helpers";
import {
  initializeEuroMint,
  createTokenAccount,
  mintTokens,
} from "../utils/token-mint-helpers";
import {
  freezeTokenAccount,
  thawTokenAccount,
  seizeTokens,
} from "../utils/freeze-seize-helpers";
import {
  getTokenBalance,
  isTokenAccountFrozen,
} from "../utils/token-utils";

// Use a generic type to avoid type conflicts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TestContext = any;

describe("Freeze and Seize Functionality", () => {
  let context: TestContext;
  let user1: Keypair;
  let user2: Keypair;

  // Set up the test context once for all tests
  before(async () => {
    // Set up the test context
    context = await setupTestContext();

    // Create keypairs for the test
    user1 = Keypair.generate();
    user2 = Keypair.generate();

    // Initialize KYC Oracle
    const oraclePDA = await initializeKycOracle(context);
    context.accounts = context.accounts || {};
    context.accounts.kycOracle = oraclePDA;

    // Register and verify KYC for users
    await setupKycForUser(context, user1, "user1");
    await setupKycForUser(context, user2, "user2");

    // Initialize the Euro mint and token accounts
    await setupTokenAccounts(context, user1, user2);
  });

  // Helper functions
  async function setupKycForUser(
    context: TestContext,
    userKeypair: Keypair,
    accountName: string
  ) {
    const { program } = context;

    // Find KYC user PDA
    const [kycUserPDA] = await program.provider.connection
      .getProgramAccounts(program.programId, {
        filters: [
          { dataSize: 8 + 200 }, // Approximate size of KycUser account
          { memcmp: { offset: 8, bytes: userKeypair.publicKey.toBase58() } },
        ],
      })
      .then((accounts) =>
        accounts.length > 0
          ? [accounts[0].pubkey]
          : [
              program.provider.connection.getProgramAddress(
                [Buffer.from("kyc-user"), userKeypair.publicKey.toBuffer()],
                program.programId
              ),
            ]
      );

    // Register user with KYC
    await registerKycUser(context, {
      userKeypair,
      blz: "12345678",
      ibanHash: `user-${userKeypair.publicKey.toBase58().slice(0, 8)}`,
      verificationLevel: 2,
      countryCode: 276, // Germany
      verificationProvider: "TEST_PROVIDER",
    });

    // Verify user
    await updateKycStatus(context, {
      kycUserPDA,
      status: { verified: {} },
      verificationLevel: 2,
      expiryDays: 365,
    });

    // Store KYC account in context
    context.accounts[`kycUser${accountName}`] = kycUserPDA;
  }

  async function setupTokenAccounts(
    context: TestContext,
    user1: Keypair,
    user2: Keypair
  ) {
    // Initialize Euro mint
    const whitepaperUri = "https://example.com/whitepaper";
    const { mintPubkey, mintInfoPubkey } = await initializeEuroMint(context, {
      whitepaperUri,
    });

    // Create token accounts for both users
    const tokenAccount1 = await createTokenAccount(context, {
      mint: mintPubkey,
      ownerKeypair: user1,
    });

    const tokenAccount2 = await createTokenAccount(context, {
      mint: mintPubkey,
      ownerKeypair: user2,
    });

    // Store accounts in context
    context.accounts.euroMint = mintPubkey;
    context.accounts.mintInfo = mintInfoPubkey;
    context.accounts.tokenAccount1 = tokenAccount1;
    context.accounts.tokenAccount2 = tokenAccount2;

    // Mint tokens to the first user to be used in the tests
    await mintTokens(context, {
      mint: mintPubkey,
      tokenAccount: tokenAccount1,
      kycUserPubkey: context.accounts.kycUseruser1,
      amount: 5000_000_000, // 5000 tokens
    });
  }

  // Test cases
  describe("Freezing and Thawing", () => {
    it("should freeze a token account", async () => {
      // Freeze the account
      await freezeTokenAccount(context, {
        mint: context.accounts.euroMint,
        tokenAccount: context.accounts.tokenAccount1,
      });

      // Verify the account is frozen
      const isFrozen = await isTokenAccountFrozen(
        context.connection,
        context.accounts.tokenAccount1
      );
      assert.isTrue(isFrozen, "Token account should be frozen");
    });

    it("should thaw a frozen token account", async () => {
      // Thaw the account
      await thawTokenAccount(context, {
        mint: context.accounts.euroMint,
        tokenAccount: context.accounts.tokenAccount1,
      });

      // Verify the account is no longer frozen
      const isFrozen = await isTokenAccountFrozen(
        context.connection,
        context.accounts.tokenAccount1
      );
      assert.isFalse(isFrozen, "Token account should not be frozen");
    });
  });

  describe("Seizing Tokens", () => {
    it("should seize tokens from a frozen account", async () => {
      // First freeze the account
      await freezeTokenAccount(context, {
        mint: context.accounts.euroMint,
        tokenAccount: context.accounts.tokenAccount1,
      });

      // Get initial balances
      const initialSourceBalance = await getTokenBalance(
        context.connection,
        context.accounts.tokenAccount1
      );
      const initialDestBalance = await getTokenBalance(
        context.connection,
        context.accounts.tokenAccount2
      );

      // Define amount to seize
      const amountToSeize = 1000_000_000; // 1000 tokens

      // Seize tokens
      await seizeTokens(context, {
        mint: context.accounts.euroMint,
        sourceTokenAccount: context.accounts.tokenAccount1,
        destinationTokenAccount: context.accounts.tokenAccount2,
        amount: amountToSeize,
      });

      // Get new balances
      const newSourceBalance = await getTokenBalance(
        context.connection,
        context.accounts.tokenAccount1
      );
      const newDestBalance = await getTokenBalance(
        context.connection,
        context.accounts.tokenAccount2
      );

      // Verify the tokens were seized
      assert.equal(
        newSourceBalance.toString(),
        (initialSourceBalance - BigInt(amountToSeize)).toString(),
        "Source account balance should decrease by seized amount"
      );

      assert.equal(
        newDestBalance.toString(),
        (initialDestBalance + BigInt(amountToSeize)).toString(),
        "Destination account balance should increase by seized amount"
      );
    });
  });
});
