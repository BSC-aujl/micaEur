import * as anchor from '@coral-xyz/anchor';
import {
  PublicKey,
  Keypair,
  SystemProgram,
  Connection,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';

/**
 * Helper function to fund test accounts
 */
export async function fundAccounts(
  connection: Connection,
  accounts: Keypair[],
  lamports: number = 10 * LAMPORTS_PER_SOL
): Promise<void> {
  const fundTxs = await Promise.all(
    accounts.map((account) => 
      connection.requestAirdrop(account.publicKey, lamports)
    )
  );
  
  // Wait for confirmations
  for (const signature of fundTxs) {
    await connection.confirmTransaction(signature);
  }
  
  // Additional delay to ensure funds are available
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

/**
 * Helper function to create token accounts for users
 */
export async function createTokenAccountsForUsers(
  connection: Connection,
  mint: PublicKey,
  users: Keypair[]
): Promise<PublicKey[]> {
  const tokenAccounts: PublicKey[] = [];
  
  for (const user of users) {
    const ata = getAssociatedTokenAddressSync(
      mint,
      user.publicKey,
      true,
      TOKEN_2022_PROGRAM_ID
    );
    
    const tx = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(
        user.publicKey,
        ata,
        user.publicKey,
        mint,
        TOKEN_2022_PROGRAM_ID
      )
    );
    
    await anchor.web3.sendAndConfirmTransaction(connection, tx, [user]);
    tokenAccounts.push(ata);
  }
  
  return tokenAccounts;
}

/**
 * Helper function to find PDAs for MintInfo and KYC accounts
 */
export function findProgramAddresses(
  programId: PublicKey,
  mint: PublicKey,
  userPubkeys: PublicKey[]
): {
  mintInfoPDA: [PublicKey, number],
  kycOraclePDA: [PublicKey, number],
  kycUserPDAs: Map<string, [PublicKey, number]>
} {
  const mintInfoSeed = Buffer.from("mint_info");
  const kycOracleSeed = Buffer.from("kyc_oracle");
  const kycUserSeed = Buffer.from("kyc_user");
  
  const mintInfoPDA = PublicKey.findProgramAddressSync(
    [mintInfoSeed, mint.toBuffer()],
    programId
  );
  
  const kycOraclePDA = PublicKey.findProgramAddressSync(
    [kycOracleSeed],
    programId
  );
  
  const kycUserPDAs = new Map<string, [PublicKey, number]>();
  
  for (const userPubkey of userPubkeys) {
    const pda = PublicKey.findProgramAddressSync(
      [kycUserSeed, userPubkey.toBuffer()],
      programId
    );
    kycUserPDAs.set(userPubkey.toString(), pda);
  }
  
  return {
    mintInfoPDA,
    kycOraclePDA,
    kycUserPDAs
  };
} 