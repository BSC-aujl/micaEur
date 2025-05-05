import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import { TestContext } from "./setup";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { findMintInfoPDA } from "./token-mint-helpers";

/**
 * Helper functions for freezing and seizing token accounts
 */

/**
 * Freeze a token account
 */
export async function freezeTokenAccount(
  context: TestContext,
  params: {
    mint: PublicKey;
    tokenAccount: PublicKey;
    freezeAuthorityKeypair?: Keypair;
  }
): Promise<void> {
  const { program } = context;
  const {
    mint,
    tokenAccount,
    freezeAuthorityKeypair = context.keypairs.authority,
  } = params;

  // Make sure mintInfo is set
  if (!context.accounts.mintInfo) {
    const [mintInfoPubkey] = findMintInfoPDA(mint, program.programId);
    context.accounts.mintInfo = mintInfoPubkey;
  }

  // Freeze token account
  await program.methods
    .freezeAccount()
    .accounts({
      freezeAuthority: freezeAuthorityKeypair.publicKey,
      mintInfo: context.accounts.mintInfo,
      mint: mint,
      tokenAccount: tokenAccount,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .signers([freezeAuthorityKeypair])
    .rpc();
}

/**
 * Thaw a token account
 */
export async function thawTokenAccount(
  context: TestContext,
  params: {
    mint: PublicKey;
    tokenAccount: PublicKey;
    freezeAuthorityKeypair?: Keypair;
  }
): Promise<void> {
  const { program } = context;
  const {
    mint,
    tokenAccount,
    freezeAuthorityKeypair = context.keypairs.authority,
  } = params;

  // Make sure mintInfo is set
  if (!context.accounts.mintInfo) {
    const [mintInfoPubkey] = findMintInfoPDA(mint, program.programId);
    context.accounts.mintInfo = mintInfoPubkey;
  }

  // Thaw token account
  await program.methods
    .thawAccount()
    .accounts({
      freezeAuthority: freezeAuthorityKeypair.publicKey,
      mintInfo: context.accounts.mintInfo,
      mint: mint,
      tokenAccount: tokenAccount,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .signers([freezeAuthorityKeypair])
    .rpc();
}

/**
 * Seize tokens from a frozen account
 */
export async function seizeTokens(
  context: TestContext,
  params: {
    mint: PublicKey;
    sourceTokenAccount: PublicKey;
    destinationTokenAccount: PublicKey;
    amount: number | bigint;
    freezeAuthorityKeypair?: Keypair;
  }
): Promise<void> {
  const { program } = context;
  const {
    mint,
    sourceTokenAccount,
    destinationTokenAccount,
    amount,
    freezeAuthorityKeypair = context.keypairs.authority,
  } = params;

  // Make sure mintInfo is set
  if (!context.accounts.mintInfo) {
    const [mintInfoPubkey] = findMintInfoPDA(mint, program.programId);
    context.accounts.mintInfo = mintInfoPubkey;
  }

  // Seize tokens
  await program.methods
    .seizeTokens(new anchor.BN(amount.toString()))
    .accounts({
      freezeAuthority: freezeAuthorityKeypair.publicKey,
      mintInfo: context.accounts.mintInfo,
      mint: mint,
      sourceTokenAccount: sourceTokenAccount,
      destinationTokenAccount: destinationTokenAccount,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .signers([freezeAuthorityKeypair])
    .rpc();
}
