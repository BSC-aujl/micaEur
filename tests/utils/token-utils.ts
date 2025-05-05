import { Connection, PublicKey } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
} from "@solana/spl-token";

/**
 * Utility functions for token operations
 */

/**
 * Get token account information
 */
export async function getTokenAccountInfo(
  connection: Connection,
  tokenAccountAddress: PublicKey
) {
  try {
    return await getAccount(
      connection,
      tokenAccountAddress,
      "confirmed",
      TOKEN_PROGRAM_ID
    );
  } catch (e) {
    console.error("Error fetching token account:", e);
    throw e;
  }
}

/**
 * Get mint information
 */
export async function getMintInfo(
  connection: Connection,
  mintAddress: PublicKey
) {
  try {
    return await getMint(
      connection,
      mintAddress,
      "confirmed",
      TOKEN_PROGRAM_ID
    );
  } catch (e) {
    console.error("Error fetching mint info:", e);
    throw e;
  }
}

/**
 * Get associated token address for a wallet
 */
export function getAssociatedTokenAddress(
  mint: PublicKey,
  owner: PublicKey
): PublicKey {
  return getAssociatedTokenAddressSync(
    mint,
    owner,
    true, // allowOwnerOffCurve
    TOKEN_PROGRAM_ID
  );
}

/**
 * Check if token account exists
 */
export async function tokenAccountExists(
  connection: Connection,
  tokenAccountAddress: PublicKey
): Promise<boolean> {
  try {
    await getAccount(
      connection,
      tokenAccountAddress,
      "confirmed",
      TOKEN_PROGRAM_ID
    );
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Get token balance
 */
export async function getTokenBalance(
  connection: Connection,
  tokenAccountAddress: PublicKey
): Promise<bigint> {
  try {
    const tokenAccount = await getAccount(
      connection,
      tokenAccountAddress,
      "confirmed",
      TOKEN_PROGRAM_ID
    );
    return tokenAccount.amount;
  } catch (e) {
    console.error("Error fetching token balance:", e);
    throw e;
  }
}

/**
 * Check if token account is frozen
 */
export async function isTokenAccountFrozen(
  connection: Connection,
  tokenAccountAddress: PublicKey
): Promise<boolean> {
  try {
    const tokenAccount = await getAccount(
      connection,
      tokenAccountAddress,
      "confirmed",
      TOKEN_PROGRAM_ID
    );
    return tokenAccount.isFrozen;
  } catch (e) {
    console.error("Error checking if token account is frozen:", e);
    throw e;
  }
}
