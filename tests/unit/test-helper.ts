import * as anchor from "@coral-xyz/anchor";
import { Keypair } from "@solana/web3.js";

// Use an ephemeral keypair for testing
const wallet = new anchor.Wallet(Keypair.generate());
const connection = new anchor.web3.Connection("http://localhost:8899", {
  commitment: "confirmed",
});

// Configure the client to use the local cluster
export const getProvider = () => {
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);
  
  return provider;
};

export const getProgram = () => {
  const provider = getProvider();
  
  // Use a hardcoded IDL instead of loading from file
  const idl = {
    "version": "0.1.0",
    "name": "mica_eur",
    "accounts": [
      {
        "name": "kycUser",
        "type": {
          "kind": "struct",
          "fields": [
            { "name": "authority", "type": "publicKey" },
            { "name": "user", "type": "publicKey" },
            { "name": "status", "type": { "defined": "KycStatus" } },
            { "name": "blz", "type": "string" },
            { "name": "ibanHash", "type": { "array": ["u8", 32] } },
            { "name": "verificationDate", "type": "i64" },
            { "name": "expiryDate", "type": "i64" },
            { "name": "verificationLevel", "type": "u8" },
            { "name": "countryCode", "type": "string" },
            { "name": "verificationProvider", "type": "string" }
          ]
        }
      },
      {
        "name": "kycOracleState",
        "type": {
          "kind": "struct",
          "fields": [
            { "name": "authority", "type": "publicKey" },
            { "name": "isActive", "type": "bool" },
            { "name": "adminCount", "type": "u8" },
            { "name": "totalVerifiedUsers", "type": "u64" },
            { "name": "lastUpdate", "type": "i64" }
          ]
        }
      }
    ],
    "types": [
      {
        "name": "KycStatus",
        "type": {
          "kind": "enum",
          "variants": [
            { "name": "Unverified" },
            { "name": "Pending" },
            { "name": "Verified" },
            { "name": "Rejected" }
          ]
        }
      }
    ],
    "instructions": [
      {
        "name": "initializeKycOracle",
        "accounts": [
          { "name": "authority", "isMut": true, "isSigner": true },
          { "name": "oracleState", "isMut": true, "isSigner": false },
          { "name": "systemProgram", "isMut": false, "isSigner": false }
        ],
        "args": []
      },
      {
        "name": "registerKycUser",
        "accounts": [
          { "name": "authority", "isMut": true, "isSigner": true },
          { "name": "oracleState", "isMut": false, "isSigner": false },
          { "name": "user", "isMut": false, "isSigner": false },
          { "name": "kycUser", "isMut": true, "isSigner": false },
          { "name": "systemProgram", "isMut": false, "isSigner": false }
        ],
        "args": [
          { "name": "blz", "type": "string" },
          { "name": "ibanHash", "type": { "array": ["u8", 32] } },
          { "name": "countryCode", "type": "string" },
          { "name": "verificationProvider", "type": "string" }
        ]
      },
      {
        "name": "updateKycStatus",
        "accounts": [
          { "name": "authority", "isMut": true, "isSigner": true },
          { "name": "oracleState", "isMut": true, "isSigner": false },
          { "name": "kycUser", "isMut": true, "isSigner": false }
        ],
        "args": [
          { "name": "status", "type": { "defined": "KycStatus" } },
          { "name": "verificationLevel", "type": "u8" },
          { "name": "expiryDays", "type": "i64" }
        ]
      }
    ]
  };
  
  const programId = new anchor.web3.PublicKey("FqyFQg8TEaxKNGd5LqHRMBKfNVQHeiohorXRiu2dATZX");
  
  // @ts-ignore - Ignore type errors for now while we're fixing the tests
  return new anchor.Program(idl, programId, provider);
};
