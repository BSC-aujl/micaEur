/**
 * TypeScript type definitions for the test framework
 *
 * This file contains all shared types and interfaces used by the test framework.
 * It helps maintain type safety and consistency across test files.
 */

import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

/**
 * Test context that is passed to test helpers and used in test files
 */
export interface TestContext {
  program: Program;
  provider: AnchorProvider;
  connection: Connection;
  payer: Keypair;
  keypairs: {
    authority: Keypair;
    mint: Keypair;
    [key: string]: Keypair;
  };
  pdas?: {
    [key: string]: PublicKey;
  };
  accounts?: {
    [key: string]: PublicKey;
  };
}

/**
 * KYC Oracle state as stored on-chain
 */
export interface KycOracleState {
  isActive: boolean;
  authority: PublicKey;
  adminCount: number;
  freezeAuthority: PublicKey;
}

/**
 * Token account state
 */
export interface TokenAccount {
  mint: PublicKey;
  owner: PublicKey;
  amount: bigint;
  delegate: PublicKey | null;
  state: TokenAccountState;
  isNative: boolean;
  delegatedAmount: bigint;
  closeAuthority: PublicKey | null;
}

/**
 * Token account state enum
 */
export enum TokenAccountState {
  Initialized = 0,
  Frozen = 1,
}

/**
 * Test configuration options
 */
export interface TestOptions {
  skipSetup?: boolean;
  useExistingValidator?: boolean;
  logLevel?: "none" | "error" | "warn" | "info" | "debug" | "trace";
  timeout?: number;
}

/**
 * Result of a test operation for chaining
 */
export interface OperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: Error;
}

/**
 * Transaction confirmation options
 */
export interface ConfirmOptions {
  skipPreflight?: boolean;
  preflightCommitment?: string;
  maxRetries?: number;
  timeout?: number;
}

/**
 * Helper to make TypeScript happy when working with enums
 * Example usage: type TokenStateKey = EnumLike<typeof TokenAccountState>;
 */
export type EnumLike<T extends Record<string, unknown>> = keyof T;

/**
 * KYC Status type
 */
export type KycStatus =
  | { unverified: Record<string, never> }
  | { pending: Record<string, never> }
  | { verified: Record<string, never> }
  | { rejected: Record<string, never> };

/**
 * KYC User Account
 */
export interface KycUser {
  // User authority
  authority: PublicKey;
  // Public key of the user
  user: PublicKey;
  // Status of the KYC verification
  status: KycStatus;
  // BankleitzahlCode (BLZ)
  blz: string;
  // Hash of the IBAN
  ibanHash: string;
  // Date of verification
  verificationDate: number;
  // Date of expiry
  expiryDate: number;
  // Verification level
  verificationLevel: number;
  // Country code
  countryCode: number;
  // Verification provider name
  verificationProvider: string;
}

/**
 * MintInfo Account
 */
export interface MintInfo {
  // The token mint address
  mint: PublicKey;
  // The issuer address
  issuer: PublicKey;
  // The freeze authority address
  freezeAuthority: PublicKey;
  // The permanent delegate address
  permanentDelegate: PublicKey;
  // URI of the whitepaper
  whitePaperUri: string;
  // Whether the mint is active
  isActive: boolean;
  // Creation timestamp
  creationTime: number;
  // Merkle root of the reserve proof
  reserveMerkleRoot: number[];
  // IPFS CID of the reserve proof
  reserveIpfsCid: string;
  // Last reserve update timestamp
  lastReserveUpdate: number;
}
