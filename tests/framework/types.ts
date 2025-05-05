/**
 * TypeScript type definitions for the test framework
 * 
 * This file contains all shared types and interfaces used by the test framework.
 * It helps maintain type safety and consistency across test files.
 */

import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';

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
  logLevel?: 'none' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
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
  | { rejected: Record<string, never> }
  | { pendingEnhancedVerification: Record<string, never> };

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
  // Required verification level (for risk-based approach)
  requiredVerificationLevel?: number;
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

/**
 * KYC Verification Levels
 */
export enum KycVerificationLevel {
  None = 0,
  User = 1,
  Business = 2
}

/**
 * KYC Provider information
 */
export interface KycProvider {
  id: string;               // Unique identifier for the provider
  name: string;             // Display name of the provider
  publicKey: PublicKey;     // Provider's authority public key
  verificationLevels: number[]; // Available verification levels
  isActive: boolean;        // Whether this provider is currently active
  trustScore: number;       // Reputation score (0-100)
  creationTime: number;     // When the provider was registered
  website?: string;         // Provider's website URL
}

/**
 * Third-party verification data
 */
export interface ThirdPartyVerification {
  providerId: string;       // ID of the KYC provider
  verificationId: string;   // Provider's reference ID
  timestamp: number;        // When verification was performed
  expiryDate: number;       // When verification expires
  verificationLevel: number;// Level of verification completed
  verificationData: string; // Encrypted verification data hash
  signature: number[];      // Signature from the provider
}

/**
 * Blacklist entry for users with revoked KYC or suspicious activity
 */
export interface BlacklistEntry {
  user: PublicKey;          // User's public key
  reason: BlacklistReason;  // Reason for blacklisting
  timestamp: number;        // When blacklisting occurred
  authority: PublicKey;     // Who initiated the blacklisting
  evidence: string;         // Reference to evidence (hash)
  expiryDate: number | null; // When blacklisting expires (null = permanent)
  actionType: BlacklistActionType; // Type of restriction applied
  actionData: Uint8Array;   // Additional data for the action
  relatedAmlAlertId?: string; // Reference to the AML alert that triggered this
}

/**
 * Reason for blacklisting
 */
export enum BlacklistReason {
  KycRevoked = 0,
  SuspiciousActivity = 1,
  RegulatoryOrder = 2,
  CourtOrder = 3,
  AmlAlert = 4,
  TemporaryRestriction = 5,
  Other = 99
}

/**
 * Type of action applied to blacklisted users
 */
export enum BlacklistActionType {
  Freeze = 0,
  Seize = 1,
  Restrict = 2,
  BlockTransfers = 3
}

/**
 * Enhanced AML Authority Powers
 */
export enum AmlAuthorityPower {
  ViewTransactions = 0,
  FreezeAccounts = 1,
  SeizeFunds = 2,
  RequestUserInfo = 3,
  IssueRegulatoryCommunications = 4,
  BlockNewTransactions = 5
}

/**
 * AML Powers for backwards compatibility
 */
export enum AmlPower {
  Monitor = 0,
  Freeze = 1,
  Seize = 2, 
  RequestInfo = 3,
  IssueRegCommunications = 4,
  BlockTransactions = 5
}

/**
 * AML Alert Types for test suite
 */
export enum AmlAlertType {
  LargeTransaction = 0,
  UnusualPattern = 1,
  SuspiciousOrigin = 2,
  StructuredTransactions = 3,
  SanctionedAddress = 4,
  HighRiskJurisdiction = 5
}

/**
 * AML authority information
 */
export interface AmlAuthority {
  authorityId: string;      // Unique identifier for the authority
  name: string;             // Name of the authority
  institution: string;      // Name of the authority institution
  publicKey: PublicKey;     // Authority's public key
  jurisdiction: string;     // Geographic jurisdiction
  contactEmail: string;     // Contact email for the authority
  powers: AmlAuthorityPower[]; // Granted powers
  active: boolean;          // Whether the authority is currently active
  creationTime: number;     // When the authority was registered
  lastActionTime: number;   // Last time the authority took action
}

/**
 * Powers granted to AML authorities (legacy)
 */
export enum LegacyAmlPower {
  Monitor = 0,              // View transaction data
  Freeze = 1,               // Freeze suspicious accounts
  Seize = 2,                // Seize funds
  RequestInfo = 3           // Request additional information
}

/**
 * Enhanced AML Alert
 */
export interface AmlAlert {
  alertId: string;          // Alert identifier
  authorityId: string;      // ID of the authority that created the alert
  user: PublicKey;          // Affected user's public key
  severity: number;         // Alert severity (1-5)
  timestamp: number;        // When alert was generated
  status: string;           // Current status
  description: string;      // Alert details
  transactionIds: string[]; // Related transaction IDs
  actionTaken: string | null; // Action taken in response to the alert
  resolution: string | null; // Resolution status
  riskScore?: number;       // Risk score if applicable
  relatedKycData?: {        // Related KYC information
    providerId: string;
    verificationLevel: number;
    verificationDate: string;
  };
}

/**
 * AML Alert status values
 */
export type AmlAlertStatus = 
  | 'OPEN'
  | 'INVESTIGATING'
  | 'ESCALATED'
  | 'ACTION_TAKEN'
  | 'RESOLVED'
  | 'CLOSED'
  | 'FALSE_POSITIVE';

/**
 * Types of AML alerts (legacy)
 */
export enum LegacyAmlAlertType {
  LargeTransaction = 0,
  UnusualPattern = 1,
  SuspiciousOrigin = 2,
  StructuredTransactions = 3
}

/**
 * Status of AML alerts (legacy)
 */
export enum LegacyAmlAlertStatus {
  New = 0,
  Investigating = 1,
  ActionTaken = 2,
  Closed = 3
} 