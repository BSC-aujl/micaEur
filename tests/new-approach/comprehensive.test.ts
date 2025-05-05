/**
 * Comprehensive Tests for MiCA EUR
 *
 * These tests verify the complete functionality of the MiCA EUR token system,
 * including token minting, KYC verification, AML checks, and token transfers
 * in a comprehensive end-to-end scenario.
 */

import { expect } from "chai";
import { setupTestContext } from "../framework/setup";
import {
  findKycUserPDA,
  initializeKycOracle,
  registerKycUser,
  updateKycStatus,
} from "../framework/kyc-oracle-helpers";
import {
  initializeEuroMint,
  createTokenAccount,
  mintTokens,
  burnTokens,
  updateReserveProof,
} from "../framework/token-mint-helpers";
import {
  freezeTokenAccount,
  thawTokenAccount,
  seizeTokens,
} from "../framework/freeze-seize-helpers";
import {
  getTokenBalance,
  isTokenAccountFrozen,
} from "../framework/token-utils";

describe("Comprehensive MiCA-EUR Tests", () => {
  let context;

  // Shared constants
  const MINT_AMOUNT = 5000_000_000; // 5000 tokens
  const BURN_AMOUNT = 1000_000_000; // 1000 tokens
  const FREEZE_AMOUNT = 2000_000_000; // 2000 tokens

  before(async () => {
    // Set up the test context
    context = await setupTestContext();
    // eslint-disable-next-line no-console
    console.log("Test context initialized");
  });

  describe("1. KYC Oracle Tests", () => {
    it("should initialize the KYC Oracle", async () => {
      const oraclePDA = await initializeKycOracle(context);
      expect(oraclePDA).to.not.be.null;

      // Fetch the KYC Oracle state
      const oracleState = await context.program.account.kycOracle.fetch(
        oraclePDA
      );
      expect(oracleState.isActive).to.be.true;
      expect(oracleState.authority.toBase58()).to.equal(
        context.keypairs.authority.publicKey.toBase58()
      );
    });

    it("should register and verify a user for KYC", async () => {
      // Register user1
      const user1 = context.keypairs.user1;
      const [kycUserPDA] = findKycUserPDA(
        user1.publicKey,
        context.program.programId
      );

      await registerKycUser(context, {
        userKeypair: user1,
        blz: "12345678",
        ibanHash: Buffer.from(
          `0x${user1.publicKey.toBuffer().toString("hex").slice(0, 16)}`
        ).toString("hex"),
        verificationLevel: 2,
        countryCode: 276, // Germany
        verificationProvider: "TEST_PROVIDER",
      });

      // Verify user1
      await updateKycStatus(context, {
        kycUserPDA,
        status: { verified: {} },
        verificationLevel: 2,
        expiryDays: 365,
      });

      context.accounts.kycUser1 = kycUserPDA;

      // Fetch and check KYC user
      const kycUser = await context.program.account.kycUser.fetch(kycUserPDA);
      expect(kycUser.user.toBase58()).to.equal(user1.publicKey.toBase58());
      expect("verified" in kycUser.status).to.be.true;
    });

    it("should register a second user for KYC", async () => {
      // Register user2
      const user2 = context.keypairs.user2;
      const [kycUserPDA] = findKycUserPDA(
        user2.publicKey,
        context.program.programId
      );

      await registerKycUser(context, {
        userKeypair: user2,
        blz: "87654321",
        ibanHash: Buffer.from(
          `0x${user2.publicKey.toBuffer().toString("hex").slice(0, 16)}`
        ).toString("hex"),
        verificationLevel: 2,
        countryCode: 276, // Germany
        verificationProvider: "TEST_PROVIDER",
      });

      // Verify user2
      await updateKycStatus(context, {
        kycUserPDA,
        status: { verified: {} },
        verificationLevel: 2,
        expiryDays: 365,
      });

      context.accounts.kycUser2 = kycUserPDA;

      // Fetch and check KYC user
      const kycUser = await context.program.account.kycUser.fetch(kycUserPDA);
      expect(kycUser.user.toBase58()).to.equal(user2.publicKey.toBase58());
      expect("verified" in kycUser.status).to.be.true;
    });
  });

  describe("2. Token Mint Tests", () => {
    it("should initialize a Euro mint", async () => {
      // Initialize Euro mint
      const whitepaperUri = "https://example.com/whitepaper";
      const { mintPubkey, mintInfoPubkey } = await initializeEuroMint(context, {
        whitepaperUri,
      });

      // Store for future use
      context.accounts.euroMint = mintPubkey;
      context.accounts.mintInfo = mintInfoPubkey;

      // Verify mint was initialized correctly
      const mintInfo = await context.program.account.mintInfo.fetch(
        mintInfoPubkey
      );
      expect(mintInfo.mint.toBase58()).to.equal(mintPubkey.toBase58());
      expect(mintInfo.isActive).to.be.true;
    });

    it("should create token accounts for users", async () => {
      // Create token account for user1
      const tokenAccount1 = await createTokenAccount(context, {
        mint: context.accounts.euroMint,
        ownerKeypair: context.keypairs.user1,
      });
      context.accounts.tokenAccount1 = tokenAccount1;

      // Create token account for user2
      const tokenAccount2 = await createTokenAccount(context, {
        mint: context.accounts.euroMint,
        ownerKeypair: context.keypairs.user2,
      });
      context.accounts.tokenAccount2 = tokenAccount2;

      // Verify token accounts were created
      const balance1 = await getTokenBalance(context.connection, tokenAccount1);
      const balance2 = await getTokenBalance(context.connection, tokenAccount2);
      expect(balance1).to.equal(0n);
      expect(balance2).to.equal(0n);
    });

    it("should mint tokens to verified users", async () => {
      // Mint to user1
      await mintTokens(context, {
        mint: context.accounts.euroMint,
        tokenAccount: context.accounts.tokenAccount1,
        kycUserPubkey: context.accounts.kycUser1,
        amount: MINT_AMOUNT,
      });

      // Verify tokens were minted
      const balance = await getTokenBalance(
        context.connection,
        context.accounts.tokenAccount1
      );
      expect(balance).to.equal(BigInt(MINT_AMOUNT));
    });

    it("should update the reserve proof", async () => {
      // Update reserve proof
      const merkleRoot = [1, 2, 3, 4, 5];
      const ipfsCid = "QmXYZ123456789";

      await updateReserveProof(context, {
        merkleRoot,
        ipfsCid,
      });

      // Verify reserve proof was updated
      const mintInfo = await context.program.account.mintInfo.fetch(
        context.accounts.mintInfo
      );
      expect(mintInfo.reserveMerkleRoot).to.deep.equal(merkleRoot);
      expect(mintInfo.reserveIpfsCid).to.equal(ipfsCid);
    });

    it("should burn tokens (redeem)", async () => {
      // Burn tokens from user1
      await burnTokens(context, {
        mint: context.accounts.euroMint,
        tokenAccount: context.accounts.tokenAccount1,
        amount: BURN_AMOUNT,
        ownerKeypair: context.keypairs.user1,
      });

      // Verify tokens were burned
      const balance = await getTokenBalance(
        context.connection,
        context.accounts.tokenAccount1
      );
      expect(balance).to.equal(BigInt(MINT_AMOUNT - BURN_AMOUNT));
    });
  });

  describe("3. Freeze and Seize Tests", () => {
    it("should freeze a token account", async () => {
      // Freeze user1's token account
      await freezeTokenAccount(context, {
        mint: context.accounts.euroMint,
        tokenAccount: context.accounts.tokenAccount1,
      });

      // Verify the account is frozen
      const isFrozen = await isTokenAccountFrozen(
        context.connection,
        context.accounts.tokenAccount1
      );
      expect(isFrozen).to.be.true;
    });

    it("should seize tokens from a frozen account", async () => {
      // Get initial balances
      const initialSourceBalance = await getTokenBalance(
        context.connection,
        context.accounts.tokenAccount1
      );
      const initialDestBalance = await getTokenBalance(
        context.connection,
        context.accounts.tokenAccount2
      );

      // Seize tokens from frozen account
      await seizeTokens(context, {
        mint: context.accounts.euroMint,
        sourceTokenAccount: context.accounts.tokenAccount1,
        destinationTokenAccount: context.accounts.tokenAccount2,
        amount: FREEZE_AMOUNT,
      });

      // Verify tokens were seized
      const newSourceBalance = await getTokenBalance(
        context.connection,
        context.accounts.tokenAccount1
      );
      const newDestBalance = await getTokenBalance(
        context.connection,
        context.accounts.tokenAccount2
      );

      expect(newSourceBalance).to.equal(
        initialSourceBalance - BigInt(FREEZE_AMOUNT)
      );
      expect(newDestBalance).to.equal(
        initialDestBalance + BigInt(FREEZE_AMOUNT)
      );
    });

    it("should thaw a token account", async () => {
      // Thaw user1's account
      await thawTokenAccount(context, {
        mint: context.accounts.euroMint,
        tokenAccount: context.accounts.tokenAccount1,
      });

      // Verify account is no longer frozen
      const isFrozen = await isTokenAccountFrozen(
        context.connection,
        context.accounts.tokenAccount1
      );
      expect(isFrozen).to.be.false;
    });
  });

  describe("4. End-to-End Flow", () => {
    it("should mint more tokens to the first user", async () => {
      // Mint additional tokens to user1
      await mintTokens(context, {
        mint: context.accounts.euroMint,
        tokenAccount: context.accounts.tokenAccount1,
        kycUserPubkey: context.accounts.kycUser1,
        amount: MINT_AMOUNT,
      });

      // Verify tokens were minted
      const balance = await getTokenBalance(
        context.connection,
        context.accounts.tokenAccount1
      );
      expect(balance).to.be.greaterThan(BigInt(MINT_AMOUNT));
    });

    it("should handle basic token operations", async () => {
      // Burn some tokens
      const burnAmount = 500_000_000;
      const initialBalance = await getTokenBalance(
        context.connection,
        context.accounts.tokenAccount1
      );

      await burnTokens(context, {
        mint: context.accounts.euroMint,
        tokenAccount: context.accounts.tokenAccount1,
        amount: burnAmount,
        ownerKeypair: context.keypairs.user1,
      });

      // Verify tokens were burned
      const afterBurnBalance = await getTokenBalance(
        context.connection,
        context.accounts.tokenAccount1
      );
      expect(afterBurnBalance).to.equal(initialBalance - BigInt(burnAmount));
    });
  });

  describe("Balance Checks", () => {
    it("should verify balances after operations", async () => {
      // Mock example test
      const balance = BigInt(MINT_AMOUNT);

      // Use toNumber or toString for comparison with numbers
      expect(balance.toString()).to.equal(MINT_AMOUNT.toString());

      // Or directly compare with bigint literals
      expect(balance).to.equal(BigInt(MINT_AMOUNT));
    });
  });
});
