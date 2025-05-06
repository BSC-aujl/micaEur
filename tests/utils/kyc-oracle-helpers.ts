/**
 * Helper functions for KYC Oracle testing
 *
 * These functions assist with initializing the KYC Oracle,
 * registering users, and managing KYC verification status.
 */

import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { TestContext, KycStatus } from "./types";

/**
 * Find the KYC Oracle PDA
 */
export function findKycOraclePDA(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("kyc_oracle")],
    programId
  );
}

/**
 * Find a KYC User PDA
 */
export function findKycUserPDA(
  userPubkey: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("kyc_user"), userPubkey.toBuffer()],
    programId
  );
}

/**
 * Initialize the KYC Oracle
 */
export async function initializeKycOracle(
  context: TestContext,
  authority?: PublicKey
): Promise<PublicKey> {
  const [oraclePDA] = await PublicKey.findProgramAddress(
    [Buffer.from("kyc-oracle")],
    context.program.programId
  );

  const authorityPubkey = authority || context.keypairs.authority.publicKey;

  try {
    await context.program.methods
      .initializeKycOracle()
      .accounts({
        kycOracle: oraclePDA,
        authority: authorityPubkey,
        systemProgram: SystemProgram.programId,
      })
      .signers([context.keypairs.authority])
      .rpc();

    return oraclePDA;
  } catch (error) {
    throw new Error(`Failed to initialize KYC Oracle: ${error.message}`);
  }
}

/**
 * Register a KYC user
 */
export async function registerKycUser(
  context: TestContext,
  params: {
    userKeypair: Keypair;
    blz: string;
    ibanHash: string;
    verificationLevel: number;
    countryCode: number;
    verificationProvider: string;
    authorityKeypair?: Keypair;
  }
): Promise<PublicKey> {
  const { program } = context;
  const {
    userKeypair,
    blz,
    ibanHash,
    verificationLevel,
    countryCode,
    verificationProvider,
    authorityKeypair = context.keypairs.authority,
  } = params;

  // Get the KYC Oracle PDA
  if (!context.accounts.kycOracle) {
    await initializeKycOracle(context, authorityKeypair.publicKey);
  }

  // Calculate the KYC User PDA
  const [kycUserPDA] = findKycUserPDA(userKeypair.publicKey, program.programId);

  try {
    // Check if already registered
    await (program.account as any).kycUser.fetch(kycUserPDA);
    // console.log('KYC User already registered, using existing PDA');
  } catch (e) {
    // Register KYC user
    await program.methods
      .registerKycUser(
        blz,
        ibanHash,
        verificationLevel,
        countryCode,
        verificationProvider
      )
      .accounts({
        authority: authorityKeypair.publicKey,
        kycOracle: context.accounts.kycOracle,
        user: userKeypair.publicKey,
        kycUser: kycUserPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authorityKeypair, userKeypair])
      .rpc();

    // console.log('KYC User registered for', userKeypair.publicKey.toString());
  }

  return kycUserPDA;
}

/**
 * Update KYC status
 */
export async function updateKycStatus(
  context: TestContext,
  params: {
    kycUserPDA: PublicKey;
    status: KycStatus;
    verificationLevel: number;
    expiryDays: number;
    authorityKeypair?: Keypair;
  }
): Promise<void> {
  const { program } = context;
  const {
    kycUserPDA,
    status,
    verificationLevel,
    expiryDays,
    authorityKeypair = context.keypairs.authority,
  } = params;

  // Get the KYC Oracle PDA
  if (!context.accounts.kycOracle) {
    await initializeKycOracle(context, authorityKeypair.publicKey);
  }

  // Update KYC status
  await program.methods
    .updateKycStatus(status, verificationLevel, expiryDays)
    .accounts({
      authority: authorityKeypair.publicKey,
      kycOracle: context.accounts.kycOracle,
      kycUser: kycUserPDA,
    })
    .signers([authorityKeypair])
    .rpc();
}

/**
 * Fetch KYC user data
 */
export async function fetchKycUser(
  context: TestContext,
  kycUserPDA: PublicKey
) {
  const { program } = context;
  return await (program.account as any).kycUser.fetch(kycUserPDA);
}

/**
 * Check if a KYC user is verified
 */
export async function isKycVerified(
  context: TestContext,
  kycUserPDA: PublicKey
): Promise<boolean> {
  const kycUser = await fetchKycUser(context, kycUserPDA);
  const currentTime = Math.floor(Date.now() / 1000);

  // User is verified if status is 'verified' and not expired
  return (
    "verified" in kycUser.status && Number(kycUser.expiryDate) > currentTime
  );
}
