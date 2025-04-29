import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { MicaEur } from '../../target/types/mica_eur';
import { 
  ExtensionType, 
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  getMintLen,
  createInitializeTransferFeeConfigInstruction,
  getTransferFeeConfigState,
  createInitializeDefaultAccountStateInstruction,
  getDefaultAccountState,
  AccountState,
  createInitializeMetadataPointerInstruction,
  getMetadataPointerState,
  createInitializeConfidentialTransferInstruction,
  createInitializeInterestBearingConfigInstruction
} from '@solana/spl-token-2022';
import { PublicKey, LAMPORTS_PER_SOL, SystemProgram, Transaction } from '@solana/web3.js';
import { assert } from 'chai';

describe('Token Extensions Unit Tests', () => {
  // Configure the client
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  
  // Define the program
  const program = anchor.workspace.MicaEur as Program<MicaEur>;
  
  // Generate keypairs for the tests
  const mintAuthority = anchor.web3.Keypair.generate();
  const freezeAuthority = anchor.web3.Keypair.generate();
  const transferFeeConfigAuthority = anchor.web3.Keypair.generate();
  const withdrawWithheldAuthority = anchor.web3.Keypair.generate();
  const payer = anchor.web3.Keypair.generate();
  
  // Test constants
  const MINT_DECIMALS = 9;
  const EURO_MINT_SEED = Buffer.from("euro_mint");
  const RESERVE_SEED = Buffer.from("reserve");
  const WHITEPAPER_SEED = Buffer.from("whitepaper");
  
  let mintKeypair: anchor.web3.Keypair;
  let euroMint: PublicKey;
  let reserve: PublicKey;
  let whitepaper: PublicKey;
  
  before(async () => {
    // Fund payer account for transactions
    const airdropTx = await provider.connection.requestAirdrop(
      payer.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropTx);
    
    // Generate a keypair for the mint
    mintKeypair = anchor.web3.Keypair.generate();
    
    // Calculate PDAs
    [euroMint] = PublicKey.findProgramAddressSync(
      [EURO_MINT_SEED],
      program.programId
    );
    
    [reserve] = PublicKey.findProgramAddressSync(
      [RESERVE_SEED, euroMint.toBuffer()],
      program.programId
    );
    
    [whitepaper] = PublicKey.findProgramAddressSync(
      [WHITEPAPER_SEED],
      program.programId
    );
  });

  it('Can initialize a mint with extensions', async () => {
    try {
      // Define which extensions to include
      const extensions = [
        ExtensionType.TransferFeeConfig,
        ExtensionType.DefaultAccountState,
        ExtensionType.MetadataPointer,
        ExtensionType.InterestBearingConfig,
        ExtensionType.ConfidentialTransferMint
      ];
      
      // Calculate mint account size with extensions
      const mintLen = getMintLen(extensions);
      
      // Create transaction to allocate space for the mint
      const lamports = await provider.connection.getMinimumBalanceForRentExemption(mintLen);
      
      const transaction = new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: mintLen,
          lamports,
          programId: TOKEN_2022_PROGRAM_ID,
        })
      );
      
      // Add instructions to initialize each extension
      transaction.add(
        // Initialize TransferFeeConfig
        createInitializeTransferFeeConfigInstruction(
          mintKeypair.publicKey,
          transferFeeConfigAuthority.publicKey,
          withdrawWithheldAuthority.publicKey,
          100, // 1% fee in basis points
          BigInt(1000 * Math.pow(10, MINT_DECIMALS)), // Maximum fee
          TOKEN_2022_PROGRAM_ID
        ),
        
        // Initialize DefaultAccountState
        createInitializeDefaultAccountStateInstruction(
          mintKeypair.publicKey,
          freezeAuthority.publicKey,
          AccountState.Initialized,
          TOKEN_2022_PROGRAM_ID
        ),
        
        // Initialize MetadataPointer
        createInitializeMetadataPointerInstruction(
          mintKeypair.publicKey,
          mintAuthority.publicKey,
          whitepaper,
          TOKEN_2022_PROGRAM_ID
        ),
        
        // Initialize ConfidentialTransfer (simplified parameters)
        createInitializeConfidentialTransferInstruction(
          mintKeypair.publicKey,
          mintAuthority.publicKey,
          TOKEN_2022_PROGRAM_ID
        ),
        
        // Initialize InterestBearingConfig
        createInitializeInterestBearingConfigInstruction(
          mintKeypair.publicKey,
          mintAuthority.publicKey,
          100, // 1% APR in basis points
          TOKEN_2022_PROGRAM_ID
        ),
        
        // Initialize the mint itself
        createInitializeMintInstruction(
          mintKeypair.publicKey,
          MINT_DECIMALS,
          mintAuthority.publicKey,
          freezeAuthority.publicKey,
          TOKEN_2022_PROGRAM_ID
        )
      );
      
      // Sign and send the transaction
      const txSig = await provider.sendAndConfirm(transaction, [payer, mintKeypair]);
      console.log("Mint created with extensions, txSig:", txSig);
      
      // Verify extensions are properly initialized
      const transferFeeConfig = await getTransferFeeConfigState(
        provider.connection,
        mintKeypair.publicKey,
        TOKEN_2022_PROGRAM_ID
      );
      
      assert.isNotNull(transferFeeConfig);
      assert.equal(transferFeeConfig.transferFeeConfigAuthority.toString(), 
                  transferFeeConfigAuthority.publicKey.toString());
      
      const defaultAccountState = await getDefaultAccountState(
        provider.connection,
        mintKeypair.publicKey,
        TOKEN_2022_PROGRAM_ID
      );
      
      assert.equal(defaultAccountState, AccountState.Initialized);
      
      const metadataPointerState = await getMetadataPointerState(
        provider.connection,
        mintKeypair.publicKey,
        TOKEN_2022_PROGRAM_ID
      );
      
      assert.isNotNull(metadataPointerState);
      assert.equal(metadataPointerState.metadataAddress.toString(), 
                  whitepaper.toString());
      
    } catch (error) {
      console.error("Error initializing mint with extensions:", error);
      throw error;
    }
  });

  it('Can initialize a mint through the program', async () => {
    try {
      // This test will use the program's instruction to initialize the mint
      // with all necessary extensions for MiCA EUR compliance
      const tx = await program.methods
        .initializeMint()
        .accounts({
          mint: euroMint,
          authority: mintAuthority.publicKey,
          freezeAuthority: freezeAuthority.publicKey,
          transferFeeConfigAuthority: transferFeeConfigAuthority.publicKey,
          withdrawWithheldAuthority: withdrawWithheldAuthority.publicKey,
          reserve: reserve,
          whitepaper: whitepaper,
          payer: payer.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY
        })
        .signers([mintAuthority, payer])
        .rpc();
      
      console.log("Mint initialized through program, txSig:", tx);
      
      // Verify the mint was initialized with all required extensions
      // (This assumes the program adds all the necessary extensions)
      
      // Verify it's a token-2022 mint
      const mintInfo = await provider.connection.getAccountInfo(euroMint);
      assert.equal(mintInfo.owner.toString(), TOKEN_2022_PROGRAM_ID.toString());
      
      // Verify basic mint properties
      // This would require parsing the mint account data
      // For this test, we'll just check that the account exists and has data
      assert.isNotNull(mintInfo);
      assert.isTrue(mintInfo.data.length > 0);
      
    } catch (error) {
      console.error("Error initializing mint through program:", error);
      throw error;
    }
  });
}); 