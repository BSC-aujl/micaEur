import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

// This is a simplified interface just for testing
export interface MicaEurProgram extends anchor.Program {
  account: {
    micaEuroMintInfo: {
      fetch: (address: PublicKey) => Promise<any>;
    };
    kycUser: {
      fetch: (address: PublicKey) => Promise<any>;
    };
    kycOracleState: {
      fetch: (address: PublicKey) => Promise<any>;
    };
  };
  methods: {
    initializeKycOracle: () => any;
    registerKycUser: (
      blz: string,
      ibanHash: number[],
      countryCode: string,
      verificationProvider: string
    ) => any;
    updateKycStatus: (
      status: any,
      verificationLevel: number,
      expiryDays: number
    ) => any;
    initializeEuroMint: (whitepaperHash: string) => any;
    mintTokens: (amount: anchor.BN, recipientKycId: string) => any;
    pauseMint: (pause: boolean) => any;
  };
} 