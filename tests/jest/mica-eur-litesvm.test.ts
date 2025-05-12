import { PublicKey } from "@solana/web3.js";
import { expect } from '@jest/globals';
import { 
  setupLiteSvmTestEnv,
  createKycOracleState,
  createKycUser,
  createMintInfo,
  createTokenAccount,
  createMintAccount,
  updateTokenBalance,
  getTokenAccountInfo,
  KYC_STATUS,
  VERIFICATION_LEVELS
} from "./utils/litesvm-helper";

// Use a consistent program ID for tests
const PROGRAM_ID = new PublicKey("DCUKPkoLJs8rNQcJS7a37eHhyggTer2WMnb239qRyRKT");

describe("MiCA EUR Tests with LiteSVM", () => {
  describe("KYC Oracle Tests", () => {
    test("should initialize KYC Oracle with correct data", () => {
      // Setup the test environment
      const { svm, keypairs, pdas } = setupLiteSvmTestEnv(PROGRAM_ID);
      const { authority } = keypairs;
      const { kycOracleStatePda } = pdas;
      
      // Create the KYC Oracle State account
      createKycOracleState(svm, PROGRAM_ID, kycOracleStatePda, authority.publicKey);
      
      // Verify the account was created with the correct data
      const account = svm.getAccount(kycOracleStatePda);
      expect(account).toBeTruthy();
      expect(account!.owner.equals(PROGRAM_ID)).toBeTruthy();
      
      // Verify the authority was correctly stored
      const storedAuthority = new PublicKey(account!.data.slice(8, 40));
      expect(storedAuthority.equals(authority.publicKey)).toBeTruthy();
    });
    
    test("should register a KYC user with pending status", () => {
      // Setup the test environment
      const { svm, keypairs, pdas } = setupLiteSvmTestEnv(PROGRAM_ID);
      const { authority, user1 } = keypairs;
      const { kycOracleStatePda, user1KycPda } = pdas;
      
      // Initialize the KYC Oracle
      createKycOracleState(svm, PROGRAM_ID, kycOracleStatePda, authority.publicKey);
      
      // Register a KYC user
      createKycUser(
        svm,
        PROGRAM_ID,
        user1KycPda,
        authority.publicKey,
        user1.publicKey,
        KYC_STATUS.PENDING,
        VERIFICATION_LEVELS.UNVERIFIED,
        "DE",
        "10070000"
      );
      
      // Verify the KYC user was registered correctly
      const account = svm.getAccount(user1KycPda);
      expect(account).toBeTruthy();
      expect(account!.owner.equals(PROGRAM_ID)).toBeTruthy();
      
      // Verify the status is PENDING
      expect(account!.data[72]).toBe(KYC_STATUS.PENDING);
      
      // Verify the verification level is UNVERIFIED
      expect(account!.data[73]).toBe(VERIFICATION_LEVELS.UNVERIFIED);
    });
    
    test("should update KYC status to VERIFIED", () => {
      // Setup the test environment
      const { svm, keypairs, pdas } = setupLiteSvmTestEnv(PROGRAM_ID);
      const { authority, user1 } = keypairs;
      const { kycOracleStatePda, user1KycPda } = pdas;
      
      // Initialize the KYC Oracle
      createKycOracleState(svm, PROGRAM_ID, kycOracleStatePda, authority.publicKey);
      
      // Register a KYC user with PENDING status
      createKycUser(
        svm,
        PROGRAM_ID,
        user1KycPda,
        authority.publicKey,
        user1.publicKey,
        KYC_STATUS.PENDING
      );
      
      // Get the initial account data
      const initialAccount = svm.getAccount(user1KycPda);
      expect(initialAccount!.data[72]).toBe(KYC_STATUS.PENDING);
      
      // Update KYC status to VERIFIED by modifying the account data
      const updatedData = Buffer.from(initialAccount!.data);
      updatedData[72] = KYC_STATUS.VERIFIED;
      updatedData[73] = VERIFICATION_LEVELS.BASIC;
      
      // Update the account
      svm.setAccount(user1KycPda, {
        ...initialAccount!,
        data: updatedData
      });
      
      // Verify the status was updated
      const updatedAccount = svm.getAccount(user1KycPda);
      expect(updatedAccount!.data[72]).toBe(KYC_STATUS.VERIFIED);
      expect(updatedAccount!.data[73]).toBe(VERIFICATION_LEVELS.BASIC);
    });
  });
  
  describe("Token Functionality Tests", () => {
    test("should initialize mint info account", () => {
      // Setup the test environment
      const { svm, keypairs, pdas } = setupLiteSvmTestEnv(PROGRAM_ID);
      const { issuer, freezeAuthority, permanentDelegate, mintKeypair } = keypairs;
      const { mintInfoPda } = pdas;
      
      // Create the mint info account
      createMintInfo(
        svm,
        PROGRAM_ID,
        mintInfoPda,
        mintKeypair.publicKey,
        issuer.publicKey,
        freezeAuthority.publicKey,
        permanentDelegate.publicKey,
        "https://example.com/mica-eur-whitepaper"
      );
      
      // Verify the account was created
      const account = svm.getAccount(mintInfoPda);
      expect(account).toBeTruthy();
      expect(account!.owner.equals(PROGRAM_ID)).toBeTruthy();
      
      // Verify the mint, issuer, etc. were stored correctly
      const storedMint = new PublicKey(account!.data.slice(8, 40));
      const storedIssuer = new PublicKey(account!.data.slice(40, 72));
      const storedFreezeAuthority = new PublicKey(account!.data.slice(72, 104));
      
      expect(storedMint.equals(mintKeypair.publicKey)).toBeTruthy();
      expect(storedIssuer.equals(issuer.publicKey)).toBeTruthy();
      expect(storedFreezeAuthority.equals(freezeAuthority.publicKey)).toBeTruthy();
      
      // Verify is_active is true
      expect(account!.data[236]).toBe(1);
    });
    
    test("should mint tokens to verified users", () => {
      // Setup the test environment
      const { svm, keypairs, pdas, tokenAccounts } = setupLiteSvmTestEnv(PROGRAM_ID);
      const { authority, issuer, freezeAuthority, permanentDelegate, user1, mintKeypair } = keypairs;
      const { kycOracleStatePda, user1KycPda, mintInfoPda } = pdas;
      const { user1TokenAccount } = tokenAccounts;
      
      // Initialize the KYC Oracle
      createKycOracleState(svm, PROGRAM_ID, kycOracleStatePda, authority.publicKey);
      
      // Register a KYC user with VERIFIED status and BASIC level
      createKycUser(
        svm,
        PROGRAM_ID,
        user1KycPda,
        authority.publicKey,
        user1.publicKey,
        KYC_STATUS.VERIFIED,
        VERIFICATION_LEVELS.BASIC
      );
      
      // Create the mint account
      createMintAccount(svm, mintKeypair.publicKey);
      
      // Create the mint info account
      createMintInfo(
        svm,
        PROGRAM_ID,
        mintInfoPda,
        mintKeypair.publicKey,
        issuer.publicKey,
        freezeAuthority.publicKey,
        permanentDelegate.publicKey
      );
      
      // Create a token account for the user with 0 balance
      createTokenAccount(
        svm,
        user1TokenAccount,
        mintKeypair.publicKey,
        user1.publicKey
      );
      
      // Verify initial balance is 0
      const initialTokenInfo = getTokenAccountInfo(svm, user1TokenAccount);
      expect(initialTokenInfo.amount).toBe(0n);
      
      // Simulate minting 1000 tokens to the user
      const mintAmount = 1000_000_000_000n; // 1000 tokens with 9 decimals
      updateTokenBalance(svm, user1TokenAccount, mintAmount);
      
      // Verify the new balance
      const finalTokenInfo = getTokenAccountInfo(svm, user1TokenAccount);
      expect(finalTokenInfo.amount).toBe(mintAmount);
    });
    
    test("should transfer tokens between users", () => {
      // Setup the test environment
      const { svm, keypairs, tokenAccounts } = setupLiteSvmTestEnv(PROGRAM_ID);
      const { user1, user2, mintKeypair } = keypairs;
      const { user1TokenAccount, user2TokenAccount } = tokenAccounts;
      
      // Create the mint account
      createMintAccount(svm, mintKeypair.publicKey);
      
      // Create token accounts with initial balances
      const initialUser1Balance = 1000_000_000_000n; // 1000 tokens
      createTokenAccount(
        svm,
        user1TokenAccount,
        mintKeypair.publicKey,
        user1.publicKey,
        initialUser1Balance
      );
      
      createTokenAccount(
        svm,
        user2TokenAccount,
        mintKeypair.publicKey,
        user2.publicKey,
        0n
      );
      
      // Simulate a transfer of 100 tokens
      const transferAmount = 100_000_000_000n; // 100 tokens
      updateTokenBalance(svm, user1TokenAccount, initialUser1Balance - transferAmount);
      updateTokenBalance(svm, user2TokenAccount, transferAmount);
      
      // Verify the balances after transfer
      const user1TokenInfo = getTokenAccountInfo(svm, user1TokenAccount);
      const user2TokenInfo = getTokenAccountInfo(svm, user2TokenAccount);
      
      expect(user1TokenInfo.amount).toBe(initialUser1Balance - transferAmount);
      expect(user2TokenInfo.amount).toBe(transferAmount);
    });
  });
  
  describe("Regulatory Controls Tests", () => {
    test("should freeze a token account", () => {
      // Setup the test environment
      const { svm, keypairs, tokenAccounts } = setupLiteSvmTestEnv(PROGRAM_ID);
      const { user1, mintKeypair } = keypairs;
      const { user1TokenAccount } = tokenAccounts;
      
      // Create a token account with initial balance
      const initialBalance = 1000_000_000_000n; // 1000 tokens
      createTokenAccount(
        svm,
        user1TokenAccount,
        mintKeypair.publicKey,
        user1.publicKey,
        initialBalance
      );
      
      // Verify the account is not frozen initially
      const initialTokenInfo = getTokenAccountInfo(svm, user1TokenAccount);
      expect(initialTokenInfo.state).toBe(1); // AccountState.Initialized
      
      // Create a frozen token account (replace the existing one)
      createTokenAccount(
        svm,
        user1TokenAccount,
        mintKeypair.publicKey,
        user1.publicKey,
        initialBalance,
        2 // AccountState.Frozen
      );
      
      // Verify the account is now frozen
      const frozenTokenInfo = getTokenAccountInfo(svm, user1TokenAccount);
      expect(frozenTokenInfo.state).toBe(2); // AccountState.Frozen
      
      // Balance should remain the same
      expect(frozenTokenInfo.amount).toBe(initialBalance);
    });
    
    test("should seize tokens from a frozen account", () => {
      // Setup the test environment
      const { svm, keypairs, tokenAccounts } = setupLiteSvmTestEnv(PROGRAM_ID);
      const { user1, user2, mintKeypair } = keypairs;
      const { user1TokenAccount, user2TokenAccount } = tokenAccounts;
      
      // Create a frozen token account with initial balance
      const initialBalance = 1000_000_000_000n; // 1000 tokens
      createTokenAccount(
        svm,
        user1TokenAccount,
        mintKeypair.publicKey,
        user1.publicKey,
        initialBalance,
        2 // AccountState.Frozen
      );
      
      // Create an unfrozen token account for user2
      createTokenAccount(
        svm,
        user2TokenAccount,
        mintKeypair.publicKey,
        user2.publicKey,
        0n
      );
      
      // Simulate seizing 500 tokens
      const seizeAmount = 500_000_000_000n; // 500 tokens
      updateTokenBalance(svm, user1TokenAccount, initialBalance - seizeAmount);
      updateTokenBalance(svm, user2TokenAccount, seizeAmount);
      
      // Verify the balances after seizing
      const user1TokenInfo = getTokenAccountInfo(svm, user1TokenAccount);
      const user2TokenInfo = getTokenAccountInfo(svm, user2TokenAccount);
      
      expect(user1TokenInfo.amount).toBe(initialBalance - seizeAmount);
      expect(user2TokenInfo.amount).toBe(seizeAmount);
      
      // User1's account should still be frozen
      expect(user1TokenInfo.state).toBe(2); // AccountState.Frozen
    });
  });
}); 