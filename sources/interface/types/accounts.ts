import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

// MintInfo account structure
export interface MintInfo {
  mint: PublicKey;
  issuer: PublicKey;
  freezeAuthority: PublicKey;
  permanentDelegate: PublicKey;
  timestamp: BN;
  totalSupply: BN;
  bump: number;
}

// Reserve account structure
export interface Reserve {
  mint: PublicKey;
  issuer: PublicKey;
  merkleRoot: number[];
  timestamp: BN;
  totalDeposits: BN;
  bump: number;
}

// KYC account structure
export interface KycAccount {
  address: PublicKey;
  kycLevel: number;
  expiryTimestamp: BN;
  verifier: PublicKey;
  timestamp: BN;
  bump: number;
}
