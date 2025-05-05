import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { TestContext, KycVerificationLevel } from "./types";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  mintTo,
  getAssociatedTokenAddress,
} from "@solana/spl-token";

/**
 * Helper functions for token mint operations
 *
 * These functions assist with creating and managing token mints,
 * including setting restrictions based on KYC status.
 */

/**
 * Find the MintInfo PDA
 */
export function findMintInfoPDA(
  mint: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("mint_info"), mint.toBuffer()],
    programId
  );
}

/**
 * Initialize the Euro mint with Token-2022 extensions
 */
export async function initializeEuroMint(
  context: TestContext,
  params: {
    mintKeypair?: Keypair;
    whitepaperUri: string;
    freezeAuthorityKeypair?: Keypair;
    permanentDelegateKeypair?: Keypair;
    issuerKeypair?: Keypair;
  }
): Promise<{
  mintPubkey: PublicKey;
  mintInfoPubkey: PublicKey;
}> {
  const { program } = context;
  const {
    mintKeypair = Keypair.generate(),
    whitepaperUri,
    freezeAuthorityKeypair = context.keypairs.authority,
    permanentDelegateKeypair = context.keypairs.authority,
    issuerKeypair = context.keypairs.authority,
  } = params;

  // Find the MintInfo PDA
  const [mintInfoPubkey] = findMintInfoPDA(
    mintKeypair.publicKey,
    program.programId
  );

  // Initialize the Euro mint
  await program.methods
    .initializeEuroMint(whitepaperUri)
    .accounts({
      issuer: issuerKeypair.publicKey,
      mintInfo: mintInfoPubkey,
      mint: mintKeypair.publicKey,
      freezeAuthority: freezeAuthorityKeypair.publicKey,
      permanentDelegate: permanentDelegateKeypair.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    })
    .signers([issuerKeypair, mintKeypair])
    .rpc();

  // Store the mint info in the context for future use
  context.accounts.euroMint = mintKeypair.publicKey;
  context.accounts.mintInfo = mintInfoPubkey;

  return {
    mintPubkey: mintKeypair.publicKey,
    mintInfoPubkey,
  };
}

/**
 * Create a token account
 */
export async function createTokenAccount(
  context: TestContext,
  params: {
    mint: PublicKey;
    ownerKeypair?: Keypair;
  }
): Promise<PublicKey> {
  const { program } = context;
  const { mint, ownerKeypair = context.keypairs.user1 } = params;

  // Create a token account (this will use the SPL function directly)
  const tokenAccountPubkey = await anchor.utils.token.associatedAddress({
    mint: mint,
    owner: ownerKeypair.publicKey,
  });

  await program.methods
    .createTokenAccount()
    .accounts({
      owner: ownerKeypair.publicKey,
      tokenAccount: tokenAccountPubkey,
      mint: mint,
      mintInfo: context.accounts.mintInfo,
      systemProgram: anchor.web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    })
    .signers([ownerKeypair])
    .rpc();

  return tokenAccountPubkey;
}

/**
 * Creates a new token mint
 */
export async function createTokenMint(
  context: TestContext,
  authority: PublicKey,
  decimals = 6,
  freezeAuthority: PublicKey | null = authority
): Promise<PublicKey> {
  return await createMint(
    context.connection,
    context.payer,
    authority,
    freezeAuthority,
    decimals
  );
}

/**
 * Creates the MiCA EUR mint and registers necessary information
 */
export async function createMicaEurMint(
  context: TestContext,
  params: {
    issuer: PublicKey;
    freezeAuthority: PublicKey;
    permanentDelegate: PublicKey;
    whitePaperUri: string;
    decimals?: number;
  }
): Promise<PublicKey> {
  // Create the basic token mint
  const mint = await createMint(
    context.connection,
    context.payer,
    params.issuer,
    params.freezeAuthority,
    params.decimals || 6
  );

  // Create the mint info account to store MiCA-specific data
  const [mintInfoPDA] = await PublicKey.findProgramAddress(
    [Buffer.from("mint-info"), mint.toBuffer()],
    context.program.programId
  );

  // Initialize the mint info with MiCA compliance information
  await context.program.methods
    .initializeMintInfo(params.whitePaperUri, params.permanentDelegate)
    .accounts({
      mintInfo: mintInfoPDA,
      mint: mint,
      issuer: params.issuer,
      freezeAuthority: params.freezeAuthority,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      payer: context.payer.publicKey,
    })
    .signers([context.payer])
    .rpc();

  return mint;
}

/**
 * Sets restrictions on a token mint based on KYC status
 */
export async function setTokenMintRestrictions(
  context: TestContext,
  params: {
    mint: PublicKey;
    authority: PublicKey;
    requiredKycLevel?: KycVerificationLevel;
    requiresKyc?: boolean;
    minKycLevel?: KycVerificationLevel;
    redemptionKycLevel?: KycVerificationLevel;
    businessRedemptionKycLevel?: KycVerificationLevel;
    enforcesBlacklist?: boolean;
    restrictedAccounts?: PublicKey[];
  }
): Promise<void> {
  // This is a simplified placeholder since the actual implementation
  // would depend on how the token restrictions are managed in the program

  // In reality, this would call the program's instruction to set KYC requirements
  // for specific accounts or operations

  const [mintInfoPDA] = await PublicKey.findProgramAddress(
    [Buffer.from("mint-info"), params.mint.toBuffer()],
    context.program.programId
  );

  // Update the mint info with restrictions
  await context.program.methods
    .updateMintRestrictions(
      params.requiredKycLevel || KycVerificationLevel.None,
      params.minKycLevel || KycVerificationLevel.None,
      params.redemptionKycLevel || KycVerificationLevel.User,
      params.businessRedemptionKycLevel || KycVerificationLevel.Business,
      params.requiresKyc || false,
      params.enforcesBlacklist || true,
      params.restrictedAccounts || []
    )
    .accounts({
      mintInfo: mintInfoPDA,
      mint: params.mint,
      authority: params.authority,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([context.keypairs.authority])
    .rpc();
}

/**
 * Mints tokens to multiple recipients
 */
export async function mintTokensToRecipients(
  context: TestContext,
  params: {
    mint: PublicKey;
    authority: Keypair;
    recipients: Array<{
      recipient: PublicKey;
      amount: number;
    }>;
  }
): Promise<void> {
  for (const { recipient, amount } of params.recipients) {
    const associatedTokenAddress = await getAssociatedTokenAddress(
      params.mint,
      recipient
    );

    await mintTo(
      context.connection,
      context.payer,
      params.mint,
      associatedTokenAddress,
      params.authority,
      amount
    );
  }
}

/**
 * Checks if redemption is allowed for a user (based on KYC level)
 */
export async function isRedemptionAllowed(
  context: TestContext,
  userPublicKey: PublicKey
): Promise<boolean> {
  // Find the user's KYC account
  const [userKycPDA] = await PublicKey.findProgramAddress(
    [Buffer.from("kyc-user"), userPublicKey.toBuffer()],
    context.program.programId
  );

  try {
    // This would normally check if the KYC status and level are sufficient
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kycStatus = await (context.program.account as any).kycUser.fetch(
      userKycPDA
    );

    // Check if the user has a verified status and the verification level is User or Business
    return (
      "verified" in kycStatus.status &&
      (kycStatus.verificationLevel === KycVerificationLevel.User ||
        kycStatus.verificationLevel === KycVerificationLevel.Business)
    );
  } catch (error) {
    // KYC account doesn't exist or error fetching it
    return false;
  }
}

/**
 * Mint tokens to a verified user
 */
export async function mintTokens(
  context: TestContext,
  params: {
    mint: PublicKey;
    tokenAccount: PublicKey;
    kycUserPubkey: PublicKey;
    amount: number | bigint;
    issuerKeypair?: Keypair;
    freezeAuthorityKeypair?: Keypair;
  }
): Promise<void> {
  const { program } = context;
  const {
    mint,
    tokenAccount,
    kycUserPubkey,
    amount,
    issuerKeypair = context.keypairs.authority,
    freezeAuthorityKeypair = context.keypairs.authority,
  } = params;

  // Make sure mintInfo is set
  if (!context.accounts.mintInfo) {
    const [mintInfoPubkey] = findMintInfoPDA(mint, program.programId);
    context.accounts.mintInfo = mintInfoPubkey;
  }

  // Mint tokens
  await program.methods
    .mintTokens(new anchor.BN(amount.toString()))
    .accounts({
      issuer: issuerKeypair.publicKey,
      mintInfo: context.accounts.mintInfo,
      mint: mint,
      tokenAccount: tokenAccount,
      kycUser: kycUserPubkey,
      freezeAuthority: freezeAuthorityKeypair.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([issuerKeypair])
    .rpc();
}

/**
 * Burn tokens (redeem)
 */
export async function burnTokens(
  context: TestContext,
  params: {
    mint: PublicKey;
    tokenAccount: PublicKey;
    amount: number | bigint;
    ownerKeypair?: Keypair;
  }
): Promise<void> {
  const { program } = context;
  const {
    mint,
    tokenAccount,
    amount,
    ownerKeypair = context.keypairs.user1,
  } = params;

  // Make sure mintInfo is set
  if (!context.accounts.mintInfo) {
    const [mintInfoPubkey] = findMintInfoPDA(mint, program.programId);
    context.accounts.mintInfo = mintInfoPubkey;
  }

  // Burn tokens
  await program.methods
    .burnTokens(new anchor.BN(amount.toString()))
    .accounts({
      owner: ownerKeypair.publicKey,
      mintInfo: context.accounts.mintInfo,
      mint: mint,
      tokenAccount: tokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([ownerKeypair])
    .rpc();
}

/**
 * Update the reserve proof
 */
export async function updateReserveProof(
  context: TestContext,
  params: {
    merkleRoot: number[];
    ipfsCid: string;
    issuerKeypair?: Keypair;
  }
): Promise<void> {
  const { program } = context;
  const {
    merkleRoot,
    ipfsCid,
    issuerKeypair = context.keypairs.authority,
  } = params;

  // Update reserve proof
  await program.methods
    .updateReserveProof(merkleRoot, ipfsCid)
    .accounts({
      issuer: issuerKeypair.publicKey,
      mintInfo: context.accounts.mintInfo,
    })
    .signers([issuerKeypair])
    .rpc();
}
