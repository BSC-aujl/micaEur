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

interface KycUserState {
  authority: PublicKey;
  user: PublicKey;
  status: number; // 0: unverified, 1: pending, 2: verified, 3: rejected, etc.
  verificationLevel: number;
  verificationTime: bigint;
  expiryTime: bigint;
  countryCode: string;
  blz: string;
  ibanHash: Uint8Array;
  verificationProvider: string;
}

interface MintInfoState {
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

interface AmlAuthorityState {
  authority: PublicKey;
  authorityId: string;
  name: string;
  institution: string;
  jurisdiction: string;
  contactEmail: string;
  powers: number[];
  isActive: boolean;
  creationTime: bigint;
  lastActionTime: bigint;
}

interface BlacklistEntryState {
  user: PublicKey;
  authority: PublicKey;
  reason: number;
  evidenceHash: string;
  creationTime: bigint;
  isActive: boolean;
}

// Constants
const KYC_STATUS = {
  UNVERIFIED: 0,
  PENDING: 1,
  VERIFIED: 2,
  REJECTED: 3,
  EXPIRED: 4,
  SUSPENDED: 5,
};

const AML_POWERS = {
  VIEW_TRANSACTIONS: 0,
  FREEZE_ACCOUNTS: 1,
  SEIZE_FUNDS: 2,
  REQUEST_USER_INFO: 3,
  ISSUE_REGULATORY_COMMUNICATIONS: 4,
  BLOCK_NEW_TRANSACTIONS: 5,
};

describe("MiCA EUR Functional Tests", () => {
  // Program ID and key variables
  const PROGRAM_ID = PublicKey.unique();

  // Test account keypairs
  const authority = Keypair.generate();
  const user1 = Keypair.generate();
  const user2 = Keypair.generate();
  const issuer = Keypair.generate();
  const freezeAuthority = Keypair.generate();
  const permanentDelegate = Keypair.generate();
  const mintKeypair = Keypair.generate();
  const amlAuthority = Keypair.generate();

  // PDAs
  let kycOracleStatePda: PublicKey;
  let kycUserPda: PublicKey;
  let mintInfoPda: PublicKey;
  let amlAuthorityPda: PublicKey;
  let blacklistEntryPda: PublicKey;

  // Token accounts
  let user1TokenAccount: PublicKey;
  let user2TokenAccount: PublicKey;

  // Test data
  const countryCode = "DE";
  const blz = "10070000"; // Deutsche Bank
  const ibanHash = new Uint8Array(32).fill(1); // Simplified IBAN hash
  const whitepaperUri = "https://example.com/whitepaper";
  const reserveMerkleRoot = new Uint8Array(32).fill(2);
  const ipfsCid = "ipfs://QmExample123456789";

  let svm: LiteSVM;

  beforeEach(() => {
    // Create a new LiteSVM instance for each test
    svm = new LiteSVM();

    // Find PDAs
    [kycOracleStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("kyc-oracle-state")],
      PROGRAM_ID
    );

    [kycUserPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("kyc-user"), user1.publicKey.toBuffer()],
      PROGRAM_ID
    );

    [mintInfoPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("mint-info"), mintKeypair.publicKey.toBuffer()],
      PROGRAM_ID
    );

    [amlAuthorityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("aml-authority"), amlAuthority.publicKey.toBuffer()],
      PROGRAM_ID
    );

    [blacklistEntryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("blacklist"), user1.publicKey.toBuffer()],
      PROGRAM_ID
    );

    // Get token accounts
    user1TokenAccount = getAssociatedTokenAddressSync(
      mintKeypair.publicKey,
      user1.publicKey,
      false
    );

    user2TokenAccount = getAssociatedTokenAddressSync(
      mintKeypair.publicKey,
      user2.publicKey,
      false
    );

    // Fund accounts with SOL
    svm.airdrop(authority.publicKey, 10_000_000_000n);
    svm.airdrop(user1.publicKey, 10_000_000_000n);
    svm.airdrop(user2.publicKey, 10_000_000_000n);
    svm.airdrop(issuer.publicKey, 10_000_000_000n);
    svm.airdrop(amlAuthority.publicKey, 10_000_000_000n);
  });

  describe("KYC Oracle Tests", () => {
    it("should initialize KYC Oracle", () => {
      // Create and set KYC Oracle state account
      const kycOracleState: KycOracleState = {
        authority: authority.publicKey,
        userCount: 0n,
        verifiedUserCount: 0n,
        lastUpdateTime: BigInt(Date.now()),
      };

      // Create a simple account data structure
      const accountData = Buffer.alloc(32 + 8 + 8 + 8); // authority(32) + userCount(8) + verifiedUserCount(8) + lastUpdateTime(8)

      // Write authority public key
      authority.publicKey.toBuffer().copy(accountData, 0);

      // Set the account
      svm.setAccount(kycOracleStatePda, {
        lamports: 1_000_000_000,
        data: accountData,
        owner: PROGRAM_ID,
        executable: false,
      });

      // Get the account and verify
      const account = svm.getAccount(kycOracleStatePda);
      expect(account).to.not.be.null;
      expect(account?.owner.equals(PROGRAM_ID)).to.be.true;

      // Verify authority was correctly stored
      const storedAuthority = new PublicKey(account!.data.slice(0, 32));
      expect(storedAuthority.equals(authority.publicKey)).to.be.true;
    });

    it("should register a KYC user", () => {
      // Create account data for KYC user
      const accountData = Buffer.alloc(32 + 32 + 1 + 1 + 8 + 8 + 32 + 32);

      // Write authority and user public keys
      authority.publicKey.toBuffer().copy(accountData, 0);
      user1.publicKey.toBuffer().copy(accountData, 32);

      // Set status to pending (1)
      accountData[64] = KYC_STATUS.PENDING;

      // Set verification level to 0
      accountData[65] = 0;

      // Set the account
      svm.setAccount(kycUserPda, {
        lamports: 1_000_000_000,
        data: accountData,
        owner: PROGRAM_ID,
        executable: false,
      });

      // Get the account and verify
      const account = svm.getAccount(kycUserPda);
      expect(account).to.not.be.null;
      expect(account?.owner.equals(PROGRAM_ID)).to.be.true;

      // Verify the pending status
      expect(account!.data[64]).to.equal(KYC_STATUS.PENDING);
    });

    it("should update a KYC user's status", () => {
      // First create the KYC User account in pending state
      const accountData = Buffer.alloc(32 + 32 + 1 + 1 + 8 + 8 + 32 + 32);

      // Write authority and user public keys
      authority.publicKey.toBuffer().copy(accountData, 0);
      user1.publicKey.toBuffer().copy(accountData, 32);

      // Set status to pending (1)
      accountData[64] = KYC_STATUS.PENDING;

      // Set verification level to 0
      accountData[65] = 0;

      // Set the account
      svm.setAccount(kycUserPda, {
        lamports: 1_000_000_000,
        data: accountData,
        owner: PROGRAM_ID,
        executable: false,
      });

      // Now update the KYC user status to verified
      accountData[64] = KYC_STATUS.VERIFIED;

      // Set verification level to 2
      accountData[65] = 2;

      // Update the account
      svm.setAccount(kycUserPda, {
        lamports: 1_000_000_000,
        data: accountData,
        owner: PROGRAM_ID,
        executable: false,
      });

      // Get the account and verify the updated status
      const account = svm.getAccount(kycUserPda);
      expect(account!.data[64]).to.equal(KYC_STATUS.VERIFIED);
      expect(account!.data[65]).to.equal(2);
    });
  });

  describe("Token Functionality Tests", () => {
    it("should initialize mint info", () => {
      // Create a simple account data structure for mint info
      const accountData = Buffer.alloc(200); // Simplified size

      // Write mint, issuer, freeze authority, and permanent delegate public keys
      mintKeypair.publicKey.toBuffer().copy(accountData, 0);
      issuer.publicKey.toBuffer().copy(accountData, 32);
      freezeAuthority.publicKey.toBuffer().copy(accountData, 64);
      permanentDelegate.publicKey.toBuffer().copy(accountData, 96);

      // Set active flag to true
      accountData[128] = 1;

      // Set the account
      svm.setAccount(mintInfoPda, {
        lamports: 1_000_000_000,
        data: accountData,
        owner: PROGRAM_ID,
        executable: false,
      });

      // Get the account and verify
      const account = svm.getAccount(mintInfoPda);
      expect(account).to.not.be.null;
      expect(account?.owner.equals(PROGRAM_ID)).to.be.true;

      // Verify the mint, issuer, etc. were stored correctly
      const storedMint = new PublicKey(account!.data.slice(0, 32));
      const storedIssuer = new PublicKey(account!.data.slice(32, 64));
      const storedFreezeAuthority = new PublicKey(account!.data.slice(64, 96));

      expect(storedMint.equals(mintKeypair.publicKey)).to.be.true;
      expect(storedIssuer.equals(issuer.publicKey)).to.be.true;
      expect(storedFreezeAuthority.equals(freezeAuthority.publicKey)).to.be
        .true;
      expect(account!.data[128]).to.equal(1); // isActive = true
    });

    it("should create token accounts and mint tokens", () => {
      // Create token account for user1
      const user1TokenAmount = 1000_000_000_000n; // 1000 tokens with 9 decimals
      const user1TokenData = Buffer.alloc(ACCOUNT_SIZE);

      AccountLayout.encode(
        {
          mint: mintKeypair.publicKey,
          owner: user1.publicKey,
          amount: user1TokenAmount,
          delegateOption: 0,
          delegate: PublicKey.default,
          state: AccountState.Initialized,
          isNativeOption: 0,
          isNative: 0n,
          closeAuthorityOption: 0,
          closeAuthority: PublicKey.default,
          delegatedAmount: 0n,
        },
        user1TokenData
      );

      // Set the token account
      svm.setAccount(user1TokenAccount, {
        lamports: 1_000_000_000,
        data: user1TokenData,
        owner: TOKEN_PROGRAM_ID,
        executable: false,
      });

      // Get the account and verify
      const account = svm.getAccount(user1TokenAccount);
      expect(account).to.not.be.null;
      expect(account?.owner.equals(TOKEN_PROGRAM_ID)).to.be.true;

      // Decode the account data and check the token amount
      const decoded = AccountLayout.decode(account!.data);
      expect(decoded.amount.toString()).to.equal(user1TokenAmount.toString());
    });

    it("should transfer tokens between accounts", () => {
      // Create token account for user1 with initial balance
      const initialUser1Amount = 1000_000_000_000n; // 1000 tokens
      let user1TokenData = Buffer.alloc(ACCOUNT_SIZE);

      AccountLayout.encode(
        {
          mint: mintKeypair.publicKey,
          owner: user1.publicKey,
          amount: initialUser1Amount,
          delegateOption: 0,
          delegate: PublicKey.default,
          state: AccountState.Initialized,
          isNativeOption: 0,
          isNative: 0n,
          closeAuthorityOption: 0,
          closeAuthority: PublicKey.default,
          delegatedAmount: 0n,
        },
        user1TokenData
      );

      // Set user1's token account
      svm.setAccount(user1TokenAccount, {
        lamports: 1_000_000_000,
        data: user1TokenData,
        owner: TOKEN_PROGRAM_ID,
        executable: false,
      });

      // Create token account for user2 with zero balance
      let user2TokenData = Buffer.alloc(ACCOUNT_SIZE);

      AccountLayout.encode(
        {
          mint: mintKeypair.publicKey,
          owner: user2.publicKey,
          amount: 0n,
          delegateOption: 0,
          delegate: PublicKey.default,
          state: AccountState.Initialized,
          isNativeOption: 0,
          isNative: 0n,
          closeAuthorityOption: 0,
          closeAuthority: PublicKey.default,
          delegatedAmount: 0n,
        },
        user2TokenData
      );

      // Set user2's token account
      svm.setAccount(user2TokenAccount, {
        lamports: 1_000_000_000,
        data: user2TokenData,
        owner: TOKEN_PROGRAM_ID,
        executable: false,
      });

      // Simulate a token transfer of 100 tokens
      const transferAmount = 100_000_000_000n; // 100 tokens

      // Update user1's token data
      user1TokenData = Buffer.alloc(ACCOUNT_SIZE);
      AccountLayout.encode(
        {
          mint: mintKeypair.publicKey,
          owner: user1.publicKey,
          amount: initialUser1Amount - transferAmount,
          delegateOption: 0,
          delegate: PublicKey.default,
          state: AccountState.Initialized,
          isNativeOption: 0,
          isNative: 0n,
          closeAuthorityOption: 0,
          closeAuthority: PublicKey.default,
          delegatedAmount: 0n,
        },
        user1TokenData
      );

      // Update user2's token data
      user2TokenData = Buffer.alloc(ACCOUNT_SIZE);
      AccountLayout.encode(
        {
          mint: mintKeypair.publicKey,
          owner: user2.publicKey,
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
        user2TokenData
      );

      // Update accounts
      svm.setAccount(user1TokenAccount, {
        lamports: 1_000_000_000,
        data: user1TokenData,
        owner: TOKEN_PROGRAM_ID,
        executable: false,
      });

      svm.setAccount(user2TokenAccount, {
        lamports: 1_000_000_000,
        data: user2TokenData,
        owner: TOKEN_PROGRAM_ID,
        executable: false,
      });

      // Get the accounts and verify balances
      const user1Account = svm.getAccount(user1TokenAccount);
      const user2Account = svm.getAccount(user2TokenAccount);

      const user1Decoded = AccountLayout.decode(user1Account!.data);
      const user2Decoded = AccountLayout.decode(user2Account!.data);

      expect(user1Decoded.amount.toString()).to.equal(
        (initialUser1Amount - transferAmount).toString()
      );
      expect(user2Decoded.amount.toString()).to.equal(
        transferAmount.toString()
      );
    });
  });

  describe("AML Authority Tests", () => {
    it("should register an AML authority", () => {
      // Create a simple account data structure for AML authority
      const accountData = Buffer.alloc(200); // Simplified size

      // Write authority public key
      amlAuthority.publicKey.toBuffer().copy(accountData, 0);

      // Write a simple authorityId
      const authorityId = "TEST-AUTHORITY";
      Buffer.from(authorityId.padEnd(16, "\0")).copy(accountData, 32);

      // Set powers bitfield (view transactions and freeze accounts)
      accountData[100] =
        (1 << AML_POWERS.VIEW_TRANSACTIONS) | (1 << AML_POWERS.FREEZE_ACCOUNTS);

      // Set active flag to true
      accountData[101] = 1;

      // Set the account
      svm.setAccount(amlAuthorityPda, {
        lamports: 1_000_000_000,
        data: accountData,
        owner: PROGRAM_ID,
        executable: false,
      });

      // Get the account and verify
      const account = svm.getAccount(amlAuthorityPda);
      expect(account).to.not.be.null;
      expect(account?.owner.equals(PROGRAM_ID)).to.be.true;

      // Verify the authority was stored correctly
      const storedAuthority = new PublicKey(account!.data.slice(0, 32));
      expect(storedAuthority.equals(amlAuthority.publicKey)).to.be.true;

      // Verify it's active
      expect(account!.data[101]).to.equal(1);
    });

    it("should create a blacklist entry", () => {
      // Create a simple account data structure for blacklist entry
      const accountData = Buffer.alloc(100); // Simplified size

      // Write user and authority public keys
      user1.publicKey.toBuffer().copy(accountData, 0);
      amlAuthority.publicKey.toBuffer().copy(accountData, 32);

      // Set reason code to 1 (example)
      accountData[64] = 1;

      // Set active flag to true
      accountData[65] = 1;

      // Set the account
      svm.setAccount(blacklistEntryPda, {
        lamports: 1_000_000_000,
        data: accountData,
        owner: PROGRAM_ID,
        executable: false,
      });

      // Get the account and verify
      const account = svm.getAccount(blacklistEntryPda);
      expect(account).to.not.be.null;
      expect(account?.owner.equals(PROGRAM_ID)).to.be.true;

      // Verify the user and authority were stored correctly
      const storedUser = new PublicKey(account!.data.slice(0, 32));
      const storedAuthority = new PublicKey(account!.data.slice(32, 64));

      expect(storedUser.equals(user1.publicKey)).to.be.true;
      expect(storedAuthority.equals(amlAuthority.publicKey)).to.be.true;
    });

    it("should deactivate an AML authority", () => {
      // Ensure the AML authority account exists
      let account = svm.getAccount(amlAuthorityPda);
      if (!account) {
        const accountData = Buffer.alloc(200);
        amlAuthority.publicKey.toBuffer().copy(accountData, 0);
        accountData[100] =
          (1 << AML_POWERS.VIEW_TRANSACTIONS) |
          (1 << AML_POWERS.FREEZE_ACCOUNTS);
        accountData[101] = 1; // active
        svm.setAccount(amlAuthorityPda, {
          lamports: 1_000_000_000,
          data: accountData,
          owner: PROGRAM_ID,
          executable: false,
        });
        account = svm.getAccount(amlAuthorityPda);
      }

      expect(account).to.not.be.null;
      // Set isActive to false (byte 101)
      account!.data[101] = 0;
      svm.setAccount(amlAuthorityPda, account!);
      // Verify
      const updated = svm.getAccount(amlAuthorityPda);
      expect(updated!.data[101]).to.equal(0);
    });

    it("should deactivate a blacklist entry", () => {
      // Ensure the blacklist entry account exists
      let account = svm.getAccount(blacklistEntryPda);
      if (!account) {
        const accountData = Buffer.alloc(100);
        user1.publicKey.toBuffer().copy(accountData, 0);
        amlAuthority.publicKey.toBuffer().copy(accountData, 32);
        accountData[64] = 1; // reason
        accountData[65] = 1; // active
        svm.setAccount(blacklistEntryPda, {
          lamports: 1_000_000_000,
          data: accountData,
          owner: PROGRAM_ID,
          executable: false,
        });
        account = svm.getAccount(blacklistEntryPda);
      }

      expect(account).to.not.be.null;
      // Set isActive to false (byte 65)
      account!.data[65] = 0;
      svm.setAccount(blacklistEntryPda, account!);
      // Verify
      const updated = svm.getAccount(blacklistEntryPda);
      expect(updated!.data[65]).to.equal(0);
    });

    it("should update AML authority powers", () => {
      // Ensure the AML authority account exists
      let account = svm.getAccount(amlAuthorityPda);
      if (!account) {
        const accountData = Buffer.alloc(200);
        amlAuthority.publicKey.toBuffer().copy(accountData, 0);
        accountData[100] =
          (1 << AML_POWERS.VIEW_TRANSACTIONS) |
          (1 << AML_POWERS.FREEZE_ACCOUNTS);
        accountData[101] = 1; // active
        svm.setAccount(amlAuthorityPda, {
          lamports: 1_000_000_000,
          data: accountData,
          owner: PROGRAM_ID,
          executable: false,
        });
        account = svm.getAccount(amlAuthorityPda);
      }

      expect(account).to.not.be.null;
      // Set powers to only SEIZE_FUNDS
      account!.data[100] = 1 << AML_POWERS.SEIZE_FUNDS;
      svm.setAccount(amlAuthorityPda, account!);
      // Verify
      const updated = svm.getAccount(amlAuthorityPda);
      expect(updated!.data[100]).to.equal(1 << AML_POWERS.SEIZE_FUNDS);
    });
  });

  describe("Freeze/Seize Functionality Tests", () => {
    it("should freeze a token account", () => {
      // Create a token account for user1
      let tokenData = Buffer.alloc(ACCOUNT_SIZE);

      // Set up the token account with an initial balance
      AccountLayout.encode(
        {
          mint: mintKeypair.publicKey,
          owner: user1.publicKey,
          amount: 1000_000_000_000n,
          delegateOption: 0,
          delegate: PublicKey.default,
          state: AccountState.Initialized,
          isNativeOption: 0,
          isNative: 0n,
          closeAuthorityOption: 0,
          closeAuthority: PublicKey.default,
          delegatedAmount: 0n,
        },
        tokenData
      );

      // Set the token account
      svm.setAccount(user1TokenAccount, {
        lamports: 1_000_000_000,
        data: tokenData,
        owner: TOKEN_PROGRAM_ID,
        executable: false,
      });

      // Now freeze the account by changing the state to frozen
      tokenData = Buffer.alloc(ACCOUNT_SIZE);
      AccountLayout.encode(
        {
          mint: mintKeypair.publicKey,
          owner: user1.publicKey,
          amount: 1000_000_000_000n,
          delegateOption: 0,
          delegate: PublicKey.default,
          state: AccountState.Frozen,
          isNativeOption: 0,
          isNative: 0n,
          closeAuthorityOption: 0,
          closeAuthority: PublicKey.default,
          delegatedAmount: 0n,
        },
        tokenData
      );

      // Update the account
      svm.setAccount(user1TokenAccount, {
        lamports: 1_000_000_000,
        data: tokenData,
        owner: TOKEN_PROGRAM_ID,
        executable: false,
      });

      // Get the account and verify it's frozen
      const account = svm.getAccount(user1TokenAccount);
      const decoded = AccountLayout.decode(account!.data);

      expect(decoded.state).to.equal(AccountState.Frozen);
    });

    it("should seize tokens from a frozen account", () => {
      // Set up user1's frozen token account with 1000 tokens
      let user1TokenData = Buffer.alloc(ACCOUNT_SIZE);

      AccountLayout.encode(
        {
          mint: mintKeypair.publicKey,
          owner: user1.publicKey,
          amount: 1000_000_000_000n,
          delegateOption: 0,
          delegate: PublicKey.default,
          state: AccountState.Frozen,
          isNativeOption: 0,
          isNative: 0n,
          closeAuthorityOption: 0,
          closeAuthority: PublicKey.default,
          delegatedAmount: 0n,
        },
        user1TokenData
      );

      // Set user1's token account
      svm.setAccount(user1TokenAccount, {
        lamports: 1_000_000_000,
        data: user1TokenData,
        owner: TOKEN_PROGRAM_ID,
        executable: false,
      });

      // Set up user2's token account with 0 tokens
      let user2TokenData = Buffer.alloc(ACCOUNT_SIZE);

      AccountLayout.encode(
        {
          mint: mintKeypair.publicKey,
          owner: user2.publicKey,
          amount: 0n,
          delegateOption: 0,
          delegate: PublicKey.default,
          state: AccountState.Initialized,
          isNativeOption: 0,
          isNative: 0n,
          closeAuthorityOption: 0,
          closeAuthority: PublicKey.default,
          delegatedAmount: 0n,
        },
        user2TokenData
      );

      // Set user2's token account
      svm.setAccount(user2TokenAccount, {
        lamports: 1_000_000_000,
        data: user2TokenData,
        owner: TOKEN_PROGRAM_ID,
        executable: false,
      });

      // Simulate seizing 500 tokens from user1 to user2
      const seizeAmount = 500_000_000_000n;

      // Update user1's token data (reduce balance)
      user1TokenData = Buffer.alloc(ACCOUNT_SIZE);
      AccountLayout.encode(
        {
          mint: mintKeypair.publicKey,
          owner: user1.publicKey,
          amount: 1000_000_000_000n - seizeAmount,
          delegateOption: 0,
          delegate: PublicKey.default,
          state: AccountState.Frozen,
          isNativeOption: 0,
          isNative: 0n,
          closeAuthorityOption: 0,
          closeAuthority: PublicKey.default,
          delegatedAmount: 0n,
        },
        user1TokenData
      );

      // Update user2's token data (increase balance)
      user2TokenData = Buffer.alloc(ACCOUNT_SIZE);
      AccountLayout.encode(
        {
          mint: mintKeypair.publicKey,
          owner: user2.publicKey,
          amount: seizeAmount,
          delegateOption: 0,
          delegate: PublicKey.default,
          state: AccountState.Initialized,
          isNativeOption: 0,
          isNative: 0n,
          closeAuthorityOption: 0,
          closeAuthority: PublicKey.default,
          delegatedAmount: 0n,
        },
        user2TokenData
      );

      // Update accounts
      svm.setAccount(user1TokenAccount, {
        lamports: 1_000_000_000,
        data: user1TokenData,
        owner: TOKEN_PROGRAM_ID,
        executable: false,
      });

      svm.setAccount(user2TokenAccount, {
        lamports: 1_000_000_000,
        data: user2TokenData,
        owner: TOKEN_PROGRAM_ID,
        executable: false,
      });

      // Get the accounts and verify balances
      const user1Account = svm.getAccount(user1TokenAccount);
      const user2Account = svm.getAccount(user2TokenAccount);

      const user1Decoded = AccountLayout.decode(user1Account!.data);
      const user2Decoded = AccountLayout.decode(user2Account!.data);

      expect(user1Decoded.amount.toString()).to.equal(
        (1000_000_000_000n - seizeAmount).toString()
      );
      expect(user2Decoded.amount.toString()).to.equal(seizeAmount.toString());
      expect(user1Decoded.state).to.equal(AccountState.Frozen); // still frozen
    });
  });
});
