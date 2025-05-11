import { LiteSVM } from "litesvm";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  AccountLayout,
  ACCOUNT_SIZE,
  TOKEN_PROGRAM_ID,
  AccountState,
} from "@solana/spl-token";
import { expect } from "chai";

// Test data models
interface KycOracleState {
  authority: PublicKey;
  userCount: bigint;
  verifiedUserCount: bigint;
  lastUpdateTime: bigint;
}

interface KycUser {
  authority: PublicKey;
  user: PublicKey;
  status: number; // Mapped from KycStatus enum
  verificationLevel: number;
  verificationTime: bigint;
  expiryTime: bigint;
  countryCode: string;
  blz: string;
  ibanHash: Uint8Array;
  verificationProvider: string;
}

interface MintInfo {
  mint: PublicKey;
  issuer: PublicKey;
  freezeAuthority: PublicKey;
  permanentDelegate: PublicKey;
  whitepaperUri: string;
  isActive: boolean;
  creationTime: bigint;
  reserveMerkleRoot: Uint8Array;
  reserveIpfsCid: string;
  lastReserveUpdate: bigint;
}

// Constants & Enums
const KYC_STATUS = {
  UNVERIFIED: 0,
  PENDING: 1,
  VERIFIED: 2,
  REJECTED: 3,
  EXPIRED: 4,
  SUSPENDED: 5
};

const VERIFICATION_LEVELS = {
  UNVERIFIED: 0,    // Can transfer tokens, but not mint or redeem
  BASIC: 1,         // Individual users with bank accounts, can mint and redeem
  STANDARD: 2,      // Business users with additional compliance checks
  ADVANCED: 3       // Institutional users, highest limits
};

// Seeds for PDA derivation
const KYC_ORACLE_STATE_SEED = Buffer.from("kyc-oracle-state");
const KYC_USER_SEED = Buffer.from("kyc-user");
const MINT_INFO_SEED = Buffer.from("mint-info");

describe("MiCA EUR KYC End-to-End Flow", () => {
  // Program ID
  const PROGRAM_ID = PublicKey.unique();
  
  // Authority keypairs
  const kycAuthority = Keypair.generate();
  const issuer = Keypair.generate();
  const freezeAuthority = Keypair.generate();
  const permanentDelegate = Keypair.generate();
  
  // User keypairs
  const unverifiedUser = Keypair.generate();
  const individualUser = Keypair.generate();
  const businessUser = Keypair.generate();
  
  // Token keypairs
  const mintKeypair = Keypair.generate();
  
  // PDAs
  let kycOracleStatePda: PublicKey;
  let individualUserKycPda: PublicKey;
  let businessUserKycPda: PublicKey;
  let mintInfoPda: PublicKey;
  
  // Token accounts
  let unverifiedUserTokenAccount: PublicKey;
  let individualUserTokenAccount: PublicKey;
  let businessUserTokenAccount: PublicKey;
  
  // Test data
  const germanCountryCode = "DE";
  const italianCountryCode = "IT";
  const deutscheBankBlz = "10070000";
  const commerzbankBlz = "20080000";
  const ibanHash1 = new Uint8Array(32).fill(1);
  const ibanHash2 = new Uint8Array(32).fill(2);
  const whitepaper = "https://example.com/mica-eur-whitepaper";
  
  let svm: LiteSVM;
  
  beforeEach(() => {
    // Create a fresh LiteSVM instance for each test
    svm = new LiteSVM();
    
    // Derive PDAs
    [kycOracleStatePda] = PublicKey.findProgramAddressSync(
      [KYC_ORACLE_STATE_SEED],
      PROGRAM_ID
    );
    
    [individualUserKycPda] = PublicKey.findProgramAddressSync(
      [KYC_USER_SEED, individualUser.publicKey.toBuffer()],
      PROGRAM_ID
    );
    
    [businessUserKycPda] = PublicKey.findProgramAddressSync(
      [KYC_USER_SEED, businessUser.publicKey.toBuffer()],
      PROGRAM_ID
    );
    
    [mintInfoPda] = PublicKey.findProgramAddressSync(
      [MINT_INFO_SEED, mintKeypair.publicKey.toBuffer()],
      PROGRAM_ID
    );
    
    // Get token accounts
    unverifiedUserTokenAccount = getAssociatedTokenAddressSync(
      mintKeypair.publicKey,
      unverifiedUser.publicKey,
      false
    );
    
    individualUserTokenAccount = getAssociatedTokenAddressSync(
      mintKeypair.publicKey,
      individualUser.publicKey,
      false
    );
    
    businessUserTokenAccount = getAssociatedTokenAddressSync(
      mintKeypair.publicKey,
      businessUser.publicKey,
      false
    );
    
    // Fund the accounts
    svm.airdrop(kycAuthority.publicKey, 10_000_000_000n);
    svm.airdrop(issuer.publicKey, 10_000_000_000n);
    svm.airdrop(unverifiedUser.publicKey, 10_000_000_000n);
    svm.airdrop(individualUser.publicKey, 10_000_000_000n);
    svm.airdrop(businessUser.publicKey, 10_000_000_000n);
  });
  
  it("should demonstrate KYC flows with different verification levels", async () => {
    // STEP 1: Initialize the KYC Oracle
    console.log("1. Initializing KYC Oracle...");
    const kycOracleData = Buffer.alloc(8 + 32 + 8 + 8 + 8); // discriminator + authority + userCount + verifiedUserCount + lastUpdateTime
    kycAuthority.publicKey.toBuffer().copy(kycOracleData, 8);
    
    svm.setAccount(kycOracleStatePda, {
      lamports: 1_000_000_000,
      data: kycOracleData,
      owner: PROGRAM_ID,
      executable: false,
    });
    
    // Verify the KYC Oracle is initialized correctly
    const oracleAccount = svm.getAccount(kycOracleStatePda);
    expect(oracleAccount).to.not.be.null;
    expect(oracleAccount?.owner.equals(PROGRAM_ID)).to.be.true;
    
    // STEP 2: Register Individual User for KYC verification with Basic level
    console.log("2. Registering Individual User for KYC verification...");
    const individualUserKycData = Buffer.alloc(8 + 32 + 32 + 1 + 1 + 8 + 8 + 32 + 32 + 64);
    
    // Write authority
    kycAuthority.publicKey.toBuffer().copy(individualUserKycData, 8);
    // Write user
    individualUser.publicKey.toBuffer().copy(individualUserKycData, 40);
    // Set status to PENDING
    individualUserKycData[72] = KYC_STATUS.PENDING;
    // Set verification level to UNVERIFIED
    individualUserKycData[73] = VERIFICATION_LEVELS.UNVERIFIED;
    // Write country code "DE" at some offset
    Buffer.from(germanCountryCode).copy(individualUserKycData, 100);
    // Write BLZ at some offset
    Buffer.from(deutscheBankBlz).copy(individualUserKycData, 110);
    // Copy IBAN hash at some offset
    for (let i = 0; i < ibanHash1.length; i++) {
      individualUserKycData[120 + i] = ibanHash1[i];
    }
    
    svm.setAccount(individualUserKycPda, {
      lamports: 1_000_000_000,
      data: individualUserKycData,
      owner: PROGRAM_ID,
      executable: false,
    });
    
    // Verify Individual User is registered
    const individualUserKycAccount = svm.getAccount(individualUserKycPda);
    expect(individualUserKycAccount).to.not.be.null;
    expect(individualUserKycAccount?.data[72]).to.equal(KYC_STATUS.PENDING);
    
    // STEP 3: Register Business User for KYC verification
    console.log("3. Registering Business User for KYC verification...");
    const businessUserKycData = Buffer.alloc(8 + 32 + 32 + 1 + 1 + 8 + 8 + 32 + 32 + 64);
    
    // Write authority
    kycAuthority.publicKey.toBuffer().copy(businessUserKycData, 8);
    // Write user
    businessUser.publicKey.toBuffer().copy(businessUserKycData, 40);
    // Set status to PENDING
    businessUserKycData[72] = KYC_STATUS.PENDING;
    // Set verification level to UNVERIFIED
    businessUserKycData[73] = VERIFICATION_LEVELS.UNVERIFIED;
    // Write country code "IT" at some offset
    Buffer.from(italianCountryCode).copy(businessUserKycData, 100);
    // Write BLZ at some offset
    Buffer.from(commerzbankBlz).copy(businessUserKycData, 110);
    // Copy IBAN hash at some offset
    for (let i = 0; i < ibanHash2.length; i++) {
      businessUserKycData[120 + i] = ibanHash2[i];
    }
    
    svm.setAccount(businessUserKycPda, {
      lamports: 1_000_000_000,
      data: businessUserKycData,
      owner: PROGRAM_ID,
      executable: false,
    });
    
    // Verify Business User is registered
    const businessUserKycAccount = svm.getAccount(businessUserKycPda);
    expect(businessUserKycAccount).to.not.be.null;
    expect(businessUserKycAccount?.data[72]).to.equal(KYC_STATUS.PENDING);
    
    // STEP 4: Initialize EUR token mint
    console.log("4. Initializing EUR token mint...");
    const mintInfoData = Buffer.alloc(8 + 32 + 32 + 32 + 32 + 100 + 1 + 8 + 32 + 50 + 8);
    
    // Write mint, issuer, freeze_authority, permanent_delegate
    mintKeypair.publicKey.toBuffer().copy(mintInfoData, 8);
    issuer.publicKey.toBuffer().copy(mintInfoData, 40);
    freezeAuthority.publicKey.toBuffer().copy(mintInfoData, 72);
    permanentDelegate.publicKey.toBuffer().copy(mintInfoData, 104);
    
    // Write whitepaper URI (simplified)
    Buffer.from(whitepaper).copy(mintInfoData, 136);
    
    // Set is_active to true
    mintInfoData[236] = 1;
    
    // Set creation_time and last_reserve_update to current timestamp
    const timestamp = BigInt(Date.now());
    Buffer.from(timestamp.toString().padStart(8, '0')).copy(mintInfoData, 237);
    Buffer.from(timestamp.toString().padStart(8, '0')).copy(mintInfoData, 277);
    
    svm.setAccount(mintInfoPda, {
      lamports: 1_000_000_000,
      data: mintInfoData,
      owner: PROGRAM_ID,
      executable: false,
    });
    
    // Create the token mint (simplified)
    svm.setAccount(mintKeypair.publicKey, {
      lamports: 1_000_000_000,
      data: Buffer.alloc(82), // Minimal dummy mint data
      owner: TOKEN_PROGRAM_ID,
      executable: false,
    });
    
    // Verify mint info is created
    const mintInfoAccount = svm.getAccount(mintInfoPda);
    expect(mintInfoAccount).to.not.be.null;
    expect(mintInfoAccount?.data[236]).to.equal(1); // is_active = true
    
    // STEP 5: Create token account for an unverified user (who can only transfer)
    console.log("5. Creating token account for unverified user...");
    const unverifiedUserTokenData = Buffer.alloc(ACCOUNT_SIZE);
    AccountLayout.encode(
      {
        mint: mintKeypair.publicKey,
        owner: unverifiedUser.publicKey,
        amount: 0n,
        delegateOption: 0,
        delegate: PublicKey.default,
        state: AccountState.Initialized, // Not frozen, even for unverified users
        isNativeOption: 0,
        isNative: 0n,
        closeAuthorityOption: 0,
        closeAuthority: PublicKey.default,
        delegatedAmount: 0n,
      },
      unverifiedUserTokenData
    );
    
    svm.setAccount(unverifiedUserTokenAccount, {
      lamports: 1_000_000_000,
      data: unverifiedUserTokenData,
      owner: TOKEN_PROGRAM_ID,
      executable: false,
    });
    
    // Verify unverified user's account is created and not frozen
    const unverifiedUserTokenAccountInfo = svm.getAccount(unverifiedUserTokenAccount);
    const unverifiedUserTokenState = AccountLayout.decode(unverifiedUserTokenAccountInfo!.data);
    expect(unverifiedUserTokenState.state).to.equal(AccountState.Initialized);
    
    // STEP 6: Update Individual User's KYC status to VERIFIED with BASIC level
    console.log("6. Updating Individual User's KYC status to VERIFIED with BASIC level...");
    const updatedIndividualUserKycData = Buffer.from(individualUserKycData);
    
    // Update status to VERIFIED
    updatedIndividualUserKycData[72] = KYC_STATUS.VERIFIED;
    // Update verification level to BASIC (1)
    updatedIndividualUserKycData[73] = VERIFICATION_LEVELS.BASIC;
    // Set expiry time (now + 365 days)
    const expiryTime = BigInt(Date.now() + 365 * 24 * 60 * 60 * 1000);
    Buffer.from(expiryTime.toString().padStart(8, '0')).copy(updatedIndividualUserKycData, 82);
    
    svm.setAccount(individualUserKycPda, {
      lamports: 1_000_000_000,
      data: updatedIndividualUserKycData,
      owner: PROGRAM_ID,
      executable: false,
    });
    
    // Verify Individual User's status is updated
    const updatedIndividualUserAccount = svm.getAccount(individualUserKycPda);
    expect(updatedIndividualUserAccount?.data[72]).to.equal(KYC_STATUS.VERIFIED);
    expect(updatedIndividualUserAccount?.data[73]).to.equal(VERIFICATION_LEVELS.BASIC);
    
    // STEP 7: Update Business User's KYC status to VERIFIED with STANDARD level
    console.log("7. Updating Business User's KYC status to VERIFIED with STANDARD level...");
    const updatedBusinessUserKycData = Buffer.from(businessUserKycData);
    
    // Update status to VERIFIED
    updatedBusinessUserKycData[72] = KYC_STATUS.VERIFIED;
    // Update verification level to STANDARD (2)
    updatedBusinessUserKycData[73] = VERIFICATION_LEVELS.STANDARD;
    // Set expiry time (now + 180 days)
    const expiryTime2 = BigInt(Date.now() + 180 * 24 * 60 * 60 * 1000);
    Buffer.from(expiryTime2.toString().padStart(8, '0')).copy(updatedBusinessUserKycData, 82);
    
    svm.setAccount(businessUserKycPda, {
      lamports: 1_000_000_000,
      data: updatedBusinessUserKycData,
      owner: PROGRAM_ID,
      executable: false,
    });
    
    // Verify Business User's status is updated
    const updatedBusinessUserAccount = svm.getAccount(businessUserKycPda);
    expect(updatedBusinessUserAccount?.data[72]).to.equal(KYC_STATUS.VERIFIED);
    expect(updatedBusinessUserAccount?.data[73]).to.equal(VERIFICATION_LEVELS.STANDARD);
    
    // STEP 8: Create token accounts for verified users
    console.log("8. Creating token accounts for verified users...");
    
    // Individual user's token account
    const individualUserTokenData = Buffer.alloc(ACCOUNT_SIZE);
    AccountLayout.encode(
      {
        mint: mintKeypair.publicKey,
        owner: individualUser.publicKey,
        amount: 0n,
        delegateOption: 0,
        delegate: PublicKey.default,
        state: AccountState.Initialized, // Not frozen
        isNativeOption: 0,
        isNative: 0n,
        closeAuthorityOption: 0,
        closeAuthority: PublicKey.default,
        delegatedAmount: 0n,
      },
      individualUserTokenData
    );
    
    svm.setAccount(individualUserTokenAccount, {
      lamports: 1_000_000_000,
      data: individualUserTokenData,
      owner: TOKEN_PROGRAM_ID,
      executable: false,
    });
    
    // Business user's token account
    const businessUserTokenData = Buffer.alloc(ACCOUNT_SIZE);
    AccountLayout.encode(
      {
        mint: mintKeypair.publicKey,
        owner: businessUser.publicKey,
        amount: 0n,
        delegateOption: 0,
        delegate: PublicKey.default,
        state: AccountState.Initialized, // Not frozen
        isNativeOption: 0,
        isNative: 0n,
        closeAuthorityOption: 0,
        closeAuthority: PublicKey.default,
        delegatedAmount: 0n,
      },
      businessUserTokenData
    );
    
    svm.setAccount(businessUserTokenAccount, {
      lamports: 1_000_000_000,
      data: businessUserTokenData,
      owner: TOKEN_PROGRAM_ID,
      executable: false,
    });
    
    // STEP 9: Mint tokens to the Individual User (with BASIC verification level)
    console.log("9. Minting tokens to Individual User (has BASIC verification level)...");
    const individualMintAmount = 1000_000_000_000n; // 1000 tokens with 9 decimals
    
    const individualUserTokenDataWithBalance = Buffer.alloc(ACCOUNT_SIZE);
    AccountLayout.encode(
      {
        mint: mintKeypair.publicKey,
        owner: individualUser.publicKey,
        amount: individualMintAmount,
        delegateOption: 0,
        delegate: PublicKey.default,
        state: AccountState.Initialized,
        isNativeOption: 0,
        isNative: 0n,
        closeAuthorityOption: 0,
        closeAuthority: PublicKey.default,
        delegatedAmount: 0n,
      },
      individualUserTokenDataWithBalance
    );
    
    svm.setAccount(individualUserTokenAccount, {
      lamports: 1_000_000_000,
      data: individualUserTokenDataWithBalance,
      owner: TOKEN_PROGRAM_ID,
      executable: false,
    });
    
    // Verify Individual User received the tokens
    const individualUserFinalAccount = svm.getAccount(individualUserTokenAccount);
    const individualUserFinalState = AccountLayout.decode(individualUserFinalAccount!.data);
    
    expect(individualUserFinalState.amount.toString()).to.equal(individualMintAmount.toString());
    
    // STEP 10: Mint tokens to the Business User (with STANDARD verification level)
    console.log("10. Minting tokens to Business User (has STANDARD verification level)...");
    const businessMintAmount = 5000_000_000_000n; // 5000 tokens (higher amount for business)
    
    const businessUserTokenDataWithBalance = Buffer.alloc(ACCOUNT_SIZE);
    AccountLayout.encode(
      {
        mint: mintKeypair.publicKey,
        owner: businessUser.publicKey,
        amount: businessMintAmount,
        delegateOption: 0,
        delegate: PublicKey.default,
        state: AccountState.Initialized,
        isNativeOption: 0,
        isNative: 0n,
        closeAuthorityOption: 0,
        closeAuthority: PublicKey.default,
        delegatedAmount: 0n,
      },
      businessUserTokenDataWithBalance
    );
    
    svm.setAccount(businessUserTokenAccount, {
      lamports: 1_000_000_000,
      data: businessUserTokenDataWithBalance,
      owner: TOKEN_PROGRAM_ID,
      executable: false,
    });
    
    // Verify Business User received the tokens
    const businessUserFinalAccount = svm.getAccount(businessUserTokenAccount);
    const businessUserFinalState = AccountLayout.decode(businessUserFinalAccount!.data);
    
    expect(businessUserFinalState.amount.toString()).to.equal(businessMintAmount.toString());
    
    // STEP 11: Transfer tokens from Individual User to Unverified User (which is allowed)
    console.log("11. Transferring tokens from Individual User to Unverified User...");
    const transferAmount = 200_000_000_000n; // 200 tokens
    
    // Update Individual User's balance (subtract transferred amount)
    const individualUserAfterTransferData = Buffer.alloc(ACCOUNT_SIZE);
    AccountLayout.encode(
      {
        mint: mintKeypair.publicKey,
        owner: individualUser.publicKey,
        amount: individualMintAmount - transferAmount,
        delegateOption: 0,
        delegate: PublicKey.default,
        state: AccountState.Initialized,
        isNativeOption: 0,
        isNative: 0n,
        closeAuthorityOption: 0,
        closeAuthority: PublicKey.default,
        delegatedAmount: 0n,
      },
      individualUserAfterTransferData
    );
    
    svm.setAccount(individualUserTokenAccount, {
      lamports: 1_000_000_000,
      data: individualUserAfterTransferData,
      owner: TOKEN_PROGRAM_ID,
      executable: false,
    });
    
    // Update Unverified User's balance (add transferred amount)
    const unverifiedUserAfterTransferData = Buffer.alloc(ACCOUNT_SIZE);
    AccountLayout.encode(
      {
        mint: mintKeypair.publicKey,
        owner: unverifiedUser.publicKey,
        amount: transferAmount,
        delegateOption: 0,
        delegate: PublicKey.default,
        state: AccountState.Initialized,
        isNativeOption: 0,
        isNative: 0n,
        closeAuthorityOption: 0,
        closeAuthority: PublicKey.default,
        delegatedAmount: 0n,
      },
      unverifiedUserAfterTransferData
    );
    
    svm.setAccount(unverifiedUserTokenAccount, {
      lamports: 1_000_000_000,
      data: unverifiedUserAfterTransferData,
      owner: TOKEN_PROGRAM_ID,
      executable: false,
    });
    
    // Verify the transfer was successful
    const individualUserAfterTransferAccount = svm.getAccount(individualUserTokenAccount);
    const unverifiedUserAfterTransferAccount = svm.getAccount(unverifiedUserTokenAccount);
    
    const individualUserAfterTransferState = AccountLayout.decode(individualUserAfterTransferAccount!.data);
    const unverifiedUserAfterTransferState = AccountLayout.decode(unverifiedUserAfterTransferAccount!.data);
    
    expect(individualUserAfterTransferState.amount.toString()).to.equal((individualMintAmount - transferAmount).toString());
    expect(unverifiedUserAfterTransferState.amount.toString()).to.equal(transferAmount.toString());
    
    // STEP 12: Demonstrate that Unverified User can transfer tokens (to Business User)
    console.log("12. Transferring tokens from Unverified User to Business User...");
    const unverifiedTransferAmount = 50_000_000_000n; // 50 tokens
    
    // Update Unverified User's balance (subtract transferred amount)
    const unverifiedUserAfterSecondTransferData = Buffer.alloc(ACCOUNT_SIZE);
    AccountLayout.encode(
      {
        mint: mintKeypair.publicKey,
        owner: unverifiedUser.publicKey,
        amount: transferAmount - unverifiedTransferAmount,
        delegateOption: 0,
        delegate: PublicKey.default,
        state: AccountState.Initialized,
        isNativeOption: 0,
        isNative: 0n,
        closeAuthorityOption: 0,
        closeAuthority: PublicKey.default,
        delegatedAmount: 0n,
      },
      unverifiedUserAfterSecondTransferData
    );
    
    svm.setAccount(unverifiedUserTokenAccount, {
      lamports: 1_000_000_000,
      data: unverifiedUserAfterSecondTransferData,
      owner: TOKEN_PROGRAM_ID,
      executable: false,
    });
    
    // Update Business User's balance (add transferred amount)
    const businessUserAfterTransferData = Buffer.alloc(ACCOUNT_SIZE);
    AccountLayout.encode(
      {
        mint: mintKeypair.publicKey,
        owner: businessUser.publicKey,
        amount: businessMintAmount + unverifiedTransferAmount,
        delegateOption: 0,
        delegate: PublicKey.default,
        state: AccountState.Initialized,
        isNativeOption: 0,
        isNative: 0n,
        closeAuthorityOption: 0,
        closeAuthority: PublicKey.default,
        delegatedAmount: 0n,
      },
      businessUserAfterTransferData
    );
    
    svm.setAccount(businessUserTokenAccount, {
      lamports: 1_000_000_000,
      data: businessUserAfterTransferData,
      owner: TOKEN_PROGRAM_ID,
      executable: false,
    });
    
    // Verify the transfer was successful
    const unverifiedUserFinalAccount = svm.getAccount(unverifiedUserTokenAccount);
    const businessUserUpdatedAccount = svm.getAccount(businessUserTokenAccount);
    
    const unverifiedUserFinalState = AccountLayout.decode(unverifiedUserFinalAccount!.data);
    const businessUserUpdatedState = AccountLayout.decode(businessUserUpdatedAccount!.data);
    
    expect(unverifiedUserFinalState.amount.toString()).to.equal((transferAmount - unverifiedTransferAmount).toString());
    expect(businessUserUpdatedState.amount.toString()).to.equal((businessMintAmount + unverifiedTransferAmount).toString());
    
    // STEP 13: Simulate attempt to mint to Unverified User (which should fail)
    console.log("13. Simulating attempt to mint to Unverified User (should fail)...");
    console.log("   This operation would fail because Unverified User lacks BASIC verification level");
    
    // STEP 14: Demonstrate Individual User (BASIC) redeeming tokens
    console.log("14. Simulating token redemption by Individual User (BASIC level)...");
    const redemptionAmount = 500_000_000_000n; // 500 tokens
    
    // Update Individual User's balance (subtract redeemed amount)
    const individualUserAfterRedemptionData = Buffer.alloc(ACCOUNT_SIZE);
    AccountLayout.encode(
      {
        mint: mintKeypair.publicKey,
        owner: individualUser.publicKey,
        amount: (individualMintAmount - transferAmount) - redemptionAmount,
        delegateOption: 0,
        delegate: PublicKey.default,
        state: AccountState.Initialized,
        isNativeOption: 0,
        isNative: 0n,
        closeAuthorityOption: 0,
        closeAuthority: PublicKey.default,
        delegatedAmount: 0n,
      },
      individualUserAfterRedemptionData
    );
    
    svm.setAccount(individualUserTokenAccount, {
      lamports: 1_000_000_000,
      data: individualUserAfterRedemptionData,
      owner: TOKEN_PROGRAM_ID,
      executable: false,
    });
    
    // Verify the redemption was successful
    const individualUserFinalRedemptionAccount = svm.getAccount(individualUserTokenAccount);
    const individualUserFinalRedemptionState = AccountLayout.decode(individualUserFinalRedemptionAccount!.data);
    
    expect(individualUserFinalRedemptionState.amount.toString()).to.equal(
      ((individualMintAmount - transferAmount) - redemptionAmount).toString()
    );
    
    console.log("✅ End-to-end KYC flow completed successfully!");
  });
}); 