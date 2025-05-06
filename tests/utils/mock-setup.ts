/**
 * Mock test setup for unit tests that don't need a real connection.
 * This allows tests to run during pre-commit hooks without needing a validator.
 */

import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";

// Define a mock MicaEur type
export type MicaEur = any;

// Simple mock context for tests
export interface MockTestContext {
  program: {
    programId: PublicKey;
    account: Record<string, any>;
    methods: {
      initializeKycOracle: () => any;
      registerKycUser: (...args: any[]) => any;
      updateKycStatus: (...args: any[]) => any;
      mintTokens: (...args: any[]) => any;
      thawAccount: (...args: any[]) => any;
      freezeAccount: (...args: any[]) => any;
      seizeTokens: (...args: any[]) => any;
      updateReserveProof: (...args: any[]) => any;
      burnTokens: (...args: any[]) => any;
    };
  };
  connection: Connection;
  keypairs: {
    authority: Keypair;
    user1: Keypair;
    user2: Keypair;
    user3: Keypair;
    [key: string]: Keypair;
  };
  accounts: {
    kycOracle?: PublicKey;
    kycUser?: PublicKey;
    kycUser1?: PublicKey;
    kycUser2?: PublicKey;
    euroMint?: PublicKey;
    mintInfo?: PublicKey;
    userTokenAccount?: PublicKey;
    tokenAccount1?: PublicKey;
    tokenAccount2?: PublicKey;
    [key: string]: PublicKey | undefined;
  };
}

/**
 * Create a mock program that returns suitable fake objects
 */
function createMockProgram(): MockTestContext['program'] {
  const programId = Keypair.generate().publicKey;
  
  return {
    programId,
    account: {
      kycUser: {
        fetch: async () => ({
          status: { verified: {} },
          expiryDate: Date.now() + 365 * 24 * 60 * 60 * 1000,
        }),
      },
      mintInfo: {
        fetch: async () => ({
          whitepaper_uri: "https://example.com/whitepaper.pdf",
          reserve_merkle_root: new Uint8Array(32),
          reserve_ipfs_cid: "fake_ipfs_cid",
        }),
      },
      group: {
        fetch: async () => ({
          policyAuthority: Keypair.generate().publicKey,
          policyAuthorityBump: 255,
        }),
      },
    },
    methods: {
      initializeKycOracle: () => ({
        accounts: () => ({
          signers: () => ({
            rpc: async () => "mock_signature",
          }),
        }),
      }),
      registerKycUser: (..._args: any[]) => ({
        accounts: () => ({
          signers: () => ({
            rpc: async () => "mock_signature",
          }),
        }),
      }),
      updateKycStatus: (..._args: any[]) => ({
        accounts: () => ({
          signers: () => ({
            rpc: async () => "mock_signature",
          }),
        }),
      }),
      mintTokens: (..._args: any[]) => ({
        accounts: () => ({
          signers: () => ({
            rpc: async () => "mock_signature",
          }),
        }),
      }),
      thawAccount: () => ({
        accounts: () => ({
          signers: () => ({
            rpc: async () => "mock_signature",
          }),
        }),
      }),
      freezeAccount: () => ({
        accounts: () => ({
          signers: () => ({
            rpc: async () => "mock_signature",
          }),
        }),
      }),
      seizeTokens: (..._args: any[]) => ({
        accounts: () => ({
          signers: () => ({
            rpc: async () => "mock_signature",
          }),
        }),
      }),
      updateReserveProof: (..._args: any[]) => ({
        accounts: () => ({
          signers: () => ({
            rpc: async () => "mock_signature",
          }),
        }),
      }),
      burnTokens: (..._args: any[]) => ({
        accounts: () => ({
          signers: () => ({
            rpc: async () => "mock_signature",
          }),
        }),
      }),
    },
  };
}

/**
 * Setup a mock test context without a real connection
 */
export function setupMockTestContext(): MockTestContext {
  // Create keypairs
  const keypairs = {
    authority: Keypair.generate(),
    user1: Keypair.generate(),
    user2: Keypair.generate(),
    user3: Keypair.generate(),
  };

  // Create a mock connection that doesn't try to connect
  const connection = new Connection("http://localhost:8899", "processed");
  
  // Create PDAs
  const mockKycOracle = Keypair.generate().publicKey;
  const mockKycUser1 = Keypair.generate().publicKey;
  const mockKycUser2 = Keypair.generate().publicKey;
  const mockMintInfo = Keypair.generate().publicKey;
  const mockEuroMint = Keypair.generate().publicKey;
  
  // Return context
  return {
    program: createMockProgram(),
    connection,
    keypairs,
    accounts: {
      kycOracle: mockKycOracle,
      kycUser1: mockKycUser1,
      kycUser2: mockKycUser2,
      mintInfo: mockMintInfo,
      euroMint: mockEuroMint,
    },
  };
}

/**
 * Mock account creation function
 */
export async function createAccount(_connection: Connection, _payer: Keypair, _mint: PublicKey, _owner: PublicKey): Promise<PublicKey> {
  return Keypair.generate().publicKey;
}

/**
 * Mock token account getter
 */
export async function getAccount(_connection: Connection, _address: PublicKey): Promise<{
  address: PublicKey;
  mint: PublicKey;
  owner: PublicKey;
  amount: bigint;
  delegate: PublicKey | null;
  state: number;
  isNative: boolean;
  delegatedAmount: bigint;
  closeAuthority: PublicKey | null;
}> {
  return {
    address: Keypair.generate().publicKey,
    mint: Keypair.generate().publicKey,
    owner: Keypair.generate().publicKey,
    amount: BigInt(1000000000),
    delegate: null,
    state: 1, // initialized state
    isNative: false,
    delegatedAmount: BigInt(0),
    closeAuthority: null,
  };
}

/**
 * Mock token transfer function
 */
export async function transfer(
  _connection: Connection,
  _payer: Keypair,
  _source: PublicKey,
  _destination: PublicKey,
  _owner: PublicKey,
  _amount: number
): Promise<string> {
  return "mock_signature";
}

/**
 * Find mock PDAs
 */
export function findProgramAddresses(
  _programId: PublicKey,
  _mintPubkey: PublicKey,
  _userPubkeys: PublicKey[]
): { mintInfoPDA: [PublicKey, number], kycOraclePDA: [PublicKey, number], kycUserPDAs: Map<string, [PublicKey, number]> } {
  const mintInfoPDA: [PublicKey, number] = [Keypair.generate().publicKey, 255];
  const kycOraclePDA: [PublicKey, number] = [Keypair.generate().publicKey, 255];
  
  const kycUserPDAs = new Map<string, [PublicKey, number]>();
  for (const userPubkey of _userPubkeys) {
    kycUserPDAs.set(userPubkey.toString(), [Keypair.generate().publicKey, 255]);
  }
  
  return { mintInfoPDA, kycOraclePDA, kycUserPDAs };
}

/**
 * Mock fund accounts function
 */
export async function fundAccounts(_connection: Connection, _keypairs: Keypair[]): Promise<void> {
  // Do nothing
} 