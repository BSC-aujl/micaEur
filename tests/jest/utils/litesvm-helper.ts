import { LiteSVM } from "litesvm";
import {
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  AccountLayout,
  ACCOUNT_SIZE,
  TOKEN_PROGRAM_ID,
  AccountState,
} from "@solana/spl-token";

export const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
);

// Seeds for PDA derivation
export const KYC_ORACLE_STATE_SEED = Buffer.from("kyc-oracle-state");
export const KYC_USER_SEED = Buffer.from("kyc-user");
export const MINT_INFO_SEED = Buffer.from("mint-info");

// Status enums
export const KYC_STATUS = {
  UNVERIFIED: 0,
  PENDING: 1,
  VERIFIED: 2,
  REJECTED: 3,
  EXPIRED: 4,
  SUSPENDED: 5,
};

export const VERIFICATION_LEVELS = {
  UNVERIFIED: 0, // Can transfer tokens, but not mint or redeem
  BASIC: 1, // Individual users with bank accounts, can mint and redeem
  STANDARD: 2, // Business users with additional compliance checks
  ADVANCED: 3, // Institutional users, highest limits
};

/**
 * Setup a LiteSVM test environment with common test accounts
 */
export function setupLiteSvmTestEnv(programId: PublicKey) {
  // Create a fresh LiteSVM instance
  const svm = new LiteSVM();

  // Create common test keypairs
  const authority = Keypair.generate();
  const issuer = Keypair.generate();
  const freezeAuthority = Keypair.generate();
  const permanentDelegate = Keypair.generate();
  const user1 = Keypair.generate();
  const user2 = Keypair.generate();
  const mintKeypair = Keypair.generate();

  // Fund accounts with SOL
  svm.airdrop(authority.publicKey, 10n * BigInt(LAMPORTS_PER_SOL));
  svm.airdrop(issuer.publicKey, 10n * BigInt(LAMPORTS_PER_SOL));
  svm.airdrop(user1.publicKey, 10n * BigInt(LAMPORTS_PER_SOL));
  svm.airdrop(user2.publicKey, 10n * BigInt(LAMPORTS_PER_SOL));

  // Find PDAs
  const [kycOracleStatePda] = PublicKey.findProgramAddressSync(
    [KYC_ORACLE_STATE_SEED],
    programId
  );

  const [user1KycPda] = PublicKey.findProgramAddressSync(
    [KYC_USER_SEED, user1.publicKey.toBuffer()],
    programId
  );

  const [user2KycPda] = PublicKey.findProgramAddressSync(
    [KYC_USER_SEED, user2.publicKey.toBuffer()],
    programId
  );

  const [mintInfoPda] = PublicKey.findProgramAddressSync(
    [MINT_INFO_SEED, mintKeypair.publicKey.toBuffer()],
    programId
  );

  // Get associated token accounts
  const user1TokenAccount = getAssociatedTokenAddressSync(
    mintKeypair.publicKey,
    user1.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  const user2TokenAccount = getAssociatedTokenAddressSync(
    mintKeypair.publicKey,
    user2.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  return {
    svm,
    keypairs: {
      authority,
      issuer,
      freezeAuthority,
      permanentDelegate,
      user1,
      user2,
      mintKeypair,
    },
    pdas: {
      kycOracleStatePda,
      user1KycPda,
      user2KycPda,
      mintInfoPda,
    },
    tokenAccounts: {
      user1TokenAccount,
      user2TokenAccount,
    },
  };
}

/**
 * Create a KYC Oracle State account
 */
export function createKycOracleState(
  svm: LiteSVM,
  programId: PublicKey,
  kycOracleStatePda: PublicKey,
  authority: PublicKey
) {
  // Create a simple account data structure
  const accountData = Buffer.alloc(8 + 32 + 8 + 8 + 8); // discriminator + authority + userCount + verifiedUserCount + lastUpdateTime

  // Write authority public key
  authority.toBuffer().copy(accountData, 8);

  // Set the account
  svm.setAccount(kycOracleStatePda, {
    lamports: LAMPORTS_PER_SOL,
    data: accountData,
    owner: programId,
    executable: false,
  });

  return accountData;
}

/**
 * Create a KYC User account
 */
export function createKycUser(
  svm: LiteSVM,
  programId: PublicKey,
  kycUserPda: PublicKey,
  authority: PublicKey,
  user: PublicKey,
  status = KYC_STATUS.PENDING,
  verificationLevel = VERIFICATION_LEVELS.UNVERIFIED,
  countryCode = "DE",
  blz = "10070000",
  ibanHash = new Uint8Array(32).fill(1)
) {
  const accountData = Buffer.alloc(
    8 + 32 + 32 + 1 + 1 + 8 + 8 + 50 + 50 + 32 + 50
  );

  // Write authority and user public keys
  authority.toBuffer().copy(accountData, 8);
  user.toBuffer().copy(accountData, 40);

  // Set status and verification level
  accountData[72] = status;
  accountData[73] = verificationLevel;

  // Write country code and BLZ at some offset
  Buffer.from(countryCode).copy(accountData, 90);
  Buffer.from(blz).copy(accountData, 100);

  // Copy IBAN hash
  for (let i = 0; i < ibanHash.length; i++) {
    accountData[120 + i] = ibanHash[i];
  }

  // Set the account
  svm.setAccount(kycUserPda, {
    lamports: LAMPORTS_PER_SOL,
    data: accountData,
    owner: programId,
    executable: false,
  });

  return accountData;
}

/**
 * Create a Mint Info account
 */
export function createMintInfo(
  svm: LiteSVM,
  programId: PublicKey,
  mintInfoPda: PublicKey,
  mint: PublicKey,
  issuer: PublicKey,
  freezeAuthority: PublicKey,
  permanentDelegate: PublicKey,
  whitepaperUri = "https://example.com/whitepaper"
) {
  const accountData = Buffer.alloc(
    8 + 32 + 32 + 32 + 32 + 100 + 1 + 8 + 32 + 50 + 8
  );

  // Write mint, issuer, freeze_authority, permanent_delegate
  mint.toBuffer().copy(accountData, 8);
  issuer.toBuffer().copy(accountData, 40);
  freezeAuthority.toBuffer().copy(accountData, 72);
  permanentDelegate.toBuffer().copy(accountData, 104);

  // Write whitepaper URI
  Buffer.from(whitepaperUri).copy(accountData, 136);

  // Set is_active to true
  accountData[236] = 1;

  // Set creation_time to current timestamp
  const timestamp = BigInt(Date.now());
  Buffer.from(timestamp.toString().padStart(8, "0")).copy(accountData, 237);

  // Set the account
  svm.setAccount(mintInfoPda, {
    lamports: LAMPORTS_PER_SOL,
    data: accountData,
    owner: programId,
    executable: false,
  });

  return accountData;
}

/**
 * Create a token account with initial balance
 */
export function createTokenAccount(
  svm: LiteSVM,
  tokenAccount: PublicKey,
  mint: PublicKey,
  owner: PublicKey,
  amount = 0n,
  state = AccountState.Initialized
) {
  const tokenData = Buffer.alloc(ACCOUNT_SIZE);

  AccountLayout.encode(
    {
      mint,
      owner,
      amount,
      delegateOption: 0,
      delegate: PublicKey.default,
      state,
      isNativeOption: 0,
      isNative: 0n,
      closeAuthorityOption: 0,
      closeAuthority: PublicKey.default,
      delegatedAmount: 0n,
    },
    tokenData
  );

  svm.setAccount(tokenAccount, {
    lamports: LAMPORTS_PER_SOL,
    data: tokenData,
    owner: TOKEN_PROGRAM_ID,
    executable: false,
  });

  return tokenData;
}

/**
 * Update token account balance
 */
export function updateTokenBalance(
  svm: LiteSVM,
  tokenAccount: PublicKey,
  newAmount: bigint
) {
  const account = svm.getAccount(tokenAccount);
  if (!account) {
    throw new Error(`Token account ${tokenAccount.toString()} not found`);
  }

  const tokenData = Buffer.from(account.data);
  const decoded = AccountLayout.decode(tokenData);

  const updatedTokenData = Buffer.alloc(ACCOUNT_SIZE);
  AccountLayout.encode(
    {
      ...decoded,
      amount: newAmount,
    },
    updatedTokenData
  );

  svm.setAccount(tokenAccount, {
    ...account,
    data: updatedTokenData,
  });

  return updatedTokenData;
}

/**
 * Get decoded token account data
 */
export function getTokenAccountInfo(svm: LiteSVM, tokenAccount: PublicKey) {
  const account = svm.getAccount(tokenAccount);
  if (!account) {
    throw new Error(`Token account ${tokenAccount.toString()} not found`);
  }

  return AccountLayout.decode(account.data);
}

/**
 * Create a simple mint account
 */
export function createMintAccount(svm: LiteSVM, mint: PublicKey) {
  // Minimal dummy mint data
  const mintData = Buffer.alloc(82);

  svm.setAccount(mint, {
    lamports: LAMPORTS_PER_SOL,
    data: mintData,
    owner: TOKEN_2022_PROGRAM_ID,
    executable: false,
  });

  return mintData;
}
