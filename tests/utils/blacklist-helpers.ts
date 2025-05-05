/**
 * Helper functions for blacklist management
 *
 * These functions assist with maintaining the blacklist - adding, updating, and removing users,
 * as well as checking blacklist status.
 */

// Signature: ZHVtbXlfc2lnbmF0dXJlX2Zvcl9ibGFja2xpc3RfaGVscGVycw==

/* eslint-disable @typescript-eslint/no-explicit-any */
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  TestContext,
  BlacklistEntry,
  BlacklistReason,
  BlacklistActionType,
} from "./types";

/**
 * Finds the PDA for a blacklist entry
 */
export async function findBlacklistPDA(
  programId: PublicKey,
  userPublicKey: PublicKey
): Promise<PublicKey> {
  const [pda] = await PublicKey.findProgramAddress(
    [Buffer.from("blacklist"), userPublicKey.toBuffer()],
    programId
  );
  return pda;
}

/**
 * Adds a user to the blacklist
 */
export async function addToBlacklist(
  context: TestContext,
  params: {
    userPublicKey: PublicKey;
    reason?: BlacklistReason;
    evidence?: string;
    expiryDate?: number;
    actionType?: BlacklistActionType;
    actionData?: Uint8Array;
  }
): Promise<void> {
  const blacklistPDA = await findBlacklistPDA(
    context.program.programId,
    params.userPublicKey
  );

  await context.program.methods
    .addToBlacklist(
      params.reason || BlacklistReason.Other,
      params.evidence || "No evidence provided",
      params.expiryDate || 0, // 0 means permanent
      params.actionType || BlacklistActionType.Freeze,
      params.actionData || Buffer.from([])
    )
    .accounts({
      blacklistEntry: blacklistPDA,
      user: params.userPublicKey,
      authority: context.keypairs.authority.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([context.keypairs.authority])
    .rpc();
}

/**
 * Updates a blacklist entry
 */
export async function updateBlacklistEntry(
  context: TestContext,
  params: {
    userPublicKey: PublicKey;
    reason?: BlacklistReason;
    evidence?: string;
    expiryDate?: number;
    actionType?: BlacklistActionType;
    actionData?: Uint8Array;
  }
): Promise<void> {
  const blacklistPDA = await findBlacklistPDA(
    context.program.programId,
    params.userPublicKey
  );

  await context.program.methods
    .updateBlacklistEntry(
      params.reason,
      params.evidence,
      params.expiryDate,
      params.actionType,
      params.actionData
    )
    .accounts({
      blacklistEntry: blacklistPDA,
      authority: context.keypairs.authority.publicKey,
    })
    .signers([context.keypairs.authority])
    .rpc();
}

/**
 * Removes a user from the blacklist
 */
export async function removeFromBlacklist(
  context: TestContext,
  userPublicKey: PublicKey
): Promise<void> {
  const blacklistPDA = await findBlacklistPDA(
    context.program.programId,
    userPublicKey
  );

  await context.program.methods
    .removeFromBlacklist()
    .accounts({
      blacklistEntry: blacklistPDA,
      authority: context.keypairs.authority.publicKey,
    })
    .signers([context.keypairs.authority])
    .rpc();
}

/**
 * Gets a blacklist entry
 */
export async function getBlacklistEntry(
  context: TestContext,
  userPublicKey: PublicKey
): Promise<BlacklistEntry | null> {
  const blacklistPDA = await findBlacklistPDA(
    context.program.programId,
    userPublicKey
  );

  try {
    return (await (context.program.account as any).blacklistEntry.fetch(
      blacklistPDA
    )) as BlacklistEntry;
  } catch (error) {
    // Entry doesn't exist
    return null;
  }
}

/**
 * Lists all blacklist entries
 */
export async function listBlacklistEntries(
  context: TestContext
): Promise<BlacklistEntry[]> {
  const entries = await (context.program.account as any).blacklistEntry.all();
  return entries.map((entry) => entry.account as BlacklistEntry);
}

/**
 * Checks if a user is blacklisted
 */
export async function isBlacklisted(
  context: TestContext,
  userPublicKey: PublicKey
): Promise<boolean> {
  const entry = await getBlacklistEntry(context, userPublicKey);
  if (!entry) {
    return false;
  }

  // Check if the entry has expired
  if (entry.expiryDate > 0 && entry.expiryDate < Date.now() / 1000) {
    // Entry has expired, should be removed
    return false;
  }

  return true;
}

/**
 * Gets blacklist status with additional details
 */
export async function getBlacklistStatus(
  context: TestContext,
  userPublicKey: PublicKey
): Promise<{
  isBlacklisted: boolean;
  reason?: BlacklistReason;
  evidence?: string;
  expiryDate?: number;
  isTemporary: boolean;
  remainingTime?: number;
}> {
  const entry = await getBlacklistEntry(context, userPublicKey);
  if (!entry) {
    return { isBlacklisted: false, isTemporary: false };
  }

  const now = Math.floor(Date.now() / 1000);
  const isTemporary = entry.expiryDate > 0;
  const isExpired = isTemporary && entry.expiryDate < now;
  const remainingTime = isTemporary
    ? Math.max(0, entry.expiryDate - now)
    : undefined;

  return {
    isBlacklisted: !isExpired,
    reason: entry.reason,
    evidence: entry.evidence,
    expiryDate: entry.expiryDate,
    isTemporary,
    remainingTime,
  };
}

/**
 * Lists all blacklisted users (alias for listBlacklistEntries)
 */
export async function listBlacklistedUsers(
  context: TestContext
): Promise<BlacklistEntry[]> {
  return listBlacklistEntries(context);
}

/**
 * Blacklists a user when their KYC is revoked
 */
export async function blacklistOnKycRevocation(
  context: TestContext,
  params: {
    userPublicKey: PublicKey;
    userKycPDA: PublicKey;
    evidence?: string;
    actionType?: BlacklistActionType;
  }
): Promise<void> {
  // 1. Blacklist the user
  await addToBlacklist(context, {
    userPublicKey: params.userPublicKey,
    reason: BlacklistReason.KycRevoked,
    evidence: params.evidence || "KYC verification revoked",
    actionType: params.actionType || BlacklistActionType.Freeze,
  });

  // 2. Update the user's KYC status to rejected
  await context.program.methods
    .updateKycStatus(
      { rejected: {} },
      0, // Reset verification level to 0
      0 // Reset expiry date
    )
    .accounts({
      kycUser: params.userKycPDA,
      authority: context.keypairs.authority.publicKey,
    })
    .signers([context.keypairs.authority])
    .rpc();
}
