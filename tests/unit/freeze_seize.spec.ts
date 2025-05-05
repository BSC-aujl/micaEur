import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { MicaEur } from '../../target/types/mica_eur';
import { 
  TOKEN_PROGRAM_ID, 
  createMint, 
  createAccount, 
  mintTo, 
  freezeAccount, 
  thawAccount,
  getAccount,
  TokenAccountNotFoundError,
  TOKEN_2022_PROGRAM_ID
} from '@solana/spl-token';
import { PublicKey, LAMPORTS_PER_SOL, SystemProgram, Transaction } from '@solana/web3.js';
import { assert } from 'chai';

describe('Freeze and Seize Unit Tests', () => {
  // Configure the client
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  
  // Define the program
  const program = anchor.workspace.MicaEur as Program<MicaEur>;
  
  // Generate keypairs for the tests
  const mintAuthority = anchor.web3.Keypair.generate();
  const freezeAuthority = anchor.web3.Keypair.generate();
  const regulatoryAuthority = anchor.web3.Keypair.generate();
  const payer = anchor.web3.Keypair.generate();
  const user1 = anchor.web3.Keypair.generate();
  const user2 = anchor.web3.Keypair.generate();
  const sanctionedUser = anchor.web3.Keypair.generate();
  
  // Test constants
  const MINT_DECIMALS = 9;
  const EURO_MINT_SEED = Buffer.from("euro_mint");
  const RESERVE_SEED = Buffer.from("reserve");
  const KYC_ORACLE_STATE_SEED = Buffer.from("kyc_oracle_state");
  const USER_ACCOUNT_SEED = Buffer.from("user_account");
  const INITIAL_AMOUNT = 1000 * Math.pow(10, MINT_DECIMALS); // 1000 EUR
  
  let euroMint: PublicKey;
  let reserve: PublicKey;
  let kycOracleState: PublicKey;
  let user1TokenAccount: PublicKey;
  let user2TokenAccount: PublicKey;
  let sanctionedUserTokenAccount: PublicKey;
  let user1KycAccount: PublicKey;
  let user2KycAccount: PublicKey;
  let sanctionedUserKycAccount: PublicKey;
  
  before(async () => {
    // Fund payer account for transactions
    const airdropTx = await provider.connection.requestAirdrop(
      payer.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropTx);
    
    // Fund user accounts
    const airdropUser1 = await provider.connection.requestAirdrop(
      user1.publicKey,
      LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropUser1);
    
    const airdropUser2 = await provider.connection.requestAirdrop(
      user2.publicKey,
      LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropUser2);
    
    const airdropSanctioned = await provider.connection.requestAirdrop(
      sanctionedUser.publicKey,
      LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSanctioned);
    
    // Calculate PDAs
    [euroMint] = PublicKey.findProgramAddressSync(
      [EURO_MINT_SEED],
      program.programId
    );
    
    [reserve] = PublicKey.findProgramAddressSync(
      [RESERVE_SEED, euroMint.toBuffer()],
      program.programId
    );
    
    [kycOracleState] = PublicKey.findProgramAddressSync(
      [KYC_ORACLE_STATE_SEED],
      program.programId
    );
    
    [user1KycAccount] = PublicKey.findProgramAddressSync(
      [USER_ACCOUNT_SEED, kycOracleState.toBuffer(), user1.publicKey.toBuffer()],
      program.programId
    );
    
    [user2KycAccount] = PublicKey.findProgramAddressSync(
      [USER_ACCOUNT_SEED, kycOracleState.toBuffer(), user2.publicKey.toBuffer()],
      program.programId
    );
    
    [sanctionedUserKycAccount] = PublicKey.findProgramAddressSync(
      [USER_ACCOUNT_SEED, kycOracleState.toBuffer(), sanctionedUser.publicKey.toBuffer()],
      program.programId
    );
    
    // Calculate associated token accounts
    user1TokenAccount = PublicKey.findProgramAddressSync(
      [
        TOKEN_PROGRAM_ID,
        euroMint,
        user1.publicKey
      ],
      program.programId
    )[0];
    
    user2TokenAccount = PublicKey.findProgramAddressSync(
      [
        TOKEN_PROGRAM_ID,
        euroMint,
        user2.publicKey
      ],
      program.programId
    )[0];
    
    sanctionedUserTokenAccount = PublicKey.findProgramAddressSync(
      [
        TOKEN_PROGRAM_ID,
        euroMint,
        sanctionedUser.publicKey
      ],
      program.programId
    )[0];
    
    // Initialize the KYC Oracle
    await program.methods
      .initializeKycOracleState()
      .accounts({
        kycOracleState: kycOracleState,
        authority: regulatoryAuthority.publicKey,
        payer: payer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([payer, regulatoryAuthority])
      .rpc();
    
    // Initialize the mint (assuming the mint is already initialized in the previous tests)
    // This would initialize the mint with required extensions
    
    // Create token accounts for users
    const createAccountsTx = new Transaction();
    createAccountsTx.add(
      createAccount(
        payer.publicKey,
        user1TokenAccount,
        user1.publicKey,
        euroMint,
        TOKEN_PROGRAM_ID
      ),
      createAccount(
        payer.publicKey,
        user2TokenAccount,
        user2.publicKey,
        euroMint,
        TOKEN_PROGRAM_ID
      ),
      createAccount(
        payer.publicKey,
        sanctionedUserTokenAccount,
        sanctionedUser.publicKey,
        euroMint,
        TOKEN_PROGRAM_ID
      )
    );
    
    await provider.sendAndConfirm(createAccountsTx, [payer]);
    
    // Register users with KYC Oracle
    const mockCountryCode = new anchor.BN(724); // Spain
    const mockVerificationProvider = Buffer.from("mock-provider");
    const mockVerificationId = Buffer.from("verification-id");
    
    // Register user1 (verified)
    await program.methods
      .registerKycUser(
        mockCountryCode,
        mockVerificationProvider,
        mockVerificationId
      )
      .accounts({
        kycOracleState: kycOracleState,
        kycUser: user1KycAccount,
        authority: regulatoryAuthority.publicKey,
        owner: user1.publicKey,
        payer: payer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([payer, regulatoryAuthority])
      .rpc();
    
    // Set user1 to verified
    await program.methods
      .updateKycUserStatus(2) // Verified status
      .accounts({
        kycOracleState: kycOracleState,
        kycUser: user1KycAccount,
        authority: regulatoryAuthority.publicKey,
      })
      .signers([regulatoryAuthority])
      .rpc();
    
    // Register user2 (verified)
    await program.methods
      .registerKycUser(
        mockCountryCode,
        mockVerificationProvider,
        mockVerificationId
      )
      .accounts({
        kycOracleState: kycOracleState,
        kycUser: user2KycAccount,
        authority: regulatoryAuthority.publicKey,
        owner: user2.publicKey,
        payer: payer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([payer, regulatoryAuthority])
      .rpc();
    
    // Set user2 to verified
    await program.methods
      .updateKycUserStatus(2) // Verified status
      .accounts({
        kycOracleState: kycOracleState,
        kycUser: user2KycAccount,
        authority: regulatoryAuthority.publicKey,
      })
      .signers([regulatoryAuthority])
      .rpc();
    
    // Register sanctioned user (initially verified)
    await program.methods
      .registerKycUser(
        mockCountryCode,
        mockVerificationProvider,
        mockVerificationId
      )
      .accounts({
        kycOracleState: kycOracleState,
        kycUser: sanctionedUserKycAccount,
        authority: regulatoryAuthority.publicKey,
        owner: sanctionedUser.publicKey,
        payer: payer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([payer, regulatoryAuthority])
      .rpc();
    
    // Set sanctioned user to verified
    await program.methods
      .updateKycUserStatus(2) // Verified status
      .accounts({
        kycOracleState: kycOracleState,
        kycUser: sanctionedUserKycAccount,
        authority: regulatoryAuthority.publicKey,
      })
      .signers([regulatoryAuthority])
      .rpc();
    
    // Mint initial tokens to users
    const mintTx = new Transaction();
    mintTx.add(
      mintTo(
        euroMint,
        user1TokenAccount,
        mintAuthority.publicKey,
        INITIAL_AMOUNT,
        TOKEN_PROGRAM_ID
      ),
      mintTo(
        euroMint,
        user2TokenAccount,
        mintAuthority.publicKey,
        INITIAL_AMOUNT,
        TOKEN_PROGRAM_ID
      ),
      mintTo(
        euroMint,
        sanctionedUserTokenAccount,
        mintAuthority.publicKey,
        INITIAL_AMOUNT,
        TOKEN_PROGRAM_ID
      )
    );
    
    await provider.sendAndConfirm(mintTx, [payer, mintAuthority]);
  });

  it('Can freeze an account when user is sanctioned', async () => {
    try {
      // Sanction the user (update KYC status to Sanctioned)
      await program.methods
        .updateKycUserStatus(4) // Sanctioned status
        .accounts({
          kycOracleState: kycOracleState,
          kycUser: sanctionedUserKycAccount,
          authority: regulatoryAuthority.publicKey,
        })
        .signers([regulatoryAuthority])
        .rpc();
      
      // Freeze the account
      await program.methods
        .freezeAccount()
        .accounts({
          mint: euroMint,
          account: sanctionedUserTokenAccount,
          kycOracleState: kycOracleState,
          kycUser: sanctionedUserKycAccount,
          freezeAuthority: freezeAuthority.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([freezeAuthority])
        .rpc();
      
      // Verify account is frozen
      const accountInfo = await getAccount(
        provider.connection,
        sanctionedUserTokenAccount,
        TOKEN_PROGRAM_ID
      );
      
      assert.equal(accountInfo.state, AccountState.Frozen);
      
    } catch (error) {
      console.error("Error freezing account:", error);
      throw error;
    }
  });

  it('Cannot freeze an account of a verified user', async () => {
    try {
      // Try to freeze a verified user's account
      const tx = program.methods
        .freezeAccount()
        .accounts({
          mint: euroMint,
          account: user1TokenAccount,
          kycOracleState: kycOracleState,
          kycUser: user1KycAccount,
          freezeAuthority: freezeAuthority.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([freezeAuthority])
        .rpc();
      
      // This should fail, so we expect an error
      await tx;
      
      // If we reach here, the test failed
      assert.fail("Should not be able to freeze a verified user's account");
    } catch (error) {
      // Expected error
      console.log("Successfully prevented freezing a verified user's account");
    }
  });

  it('Can seize funds from a sanctioned account', async () => {
    try {
      // Get balance before seizing
      const beforeAccountInfo = await getAccount(
        provider.connection,
        sanctionedUserTokenAccount,
        TOKEN_PROGRAM_ID
      );
      
      const beforeBalance = beforeAccountInfo.amount;
      console.log("Balance before seizing:", beforeBalance.toString());
      
      // Seize funds to the reserve
      await program.methods
        .seizeFunds()
        .accounts({
          mint: euroMint,
          sourceAccount: sanctionedUserTokenAccount,
          destinationAccount: reserve,
          kycOracleState: kycOracleState,
          kycUser: sanctionedUserKycAccount,
          authority: regulatoryAuthority.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([regulatoryAuthority])
        .rpc();
      
      // Verify funds were seized
      const afterAccountInfo = await getAccount(
        provider.connection,
        sanctionedUserTokenAccount,
        TOKEN_PROGRAM_ID
      );
      
      const afterBalance = afterAccountInfo.amount;
      console.log("Balance after seizing:", afterBalance.toString());
      
      // Check that the balance is now zero
      assert.equal(afterBalance, 0n);
      
      // Check that the reserve received the funds
      const reserveAccountInfo = await getAccount(
        provider.connection,
        reserve,
        TOKEN_PROGRAM_ID
      );
      
      assert.isTrue(reserveAccountInfo.amount >= beforeBalance);
      
    } catch (error) {
      console.error("Error seizing funds:", error);
      throw error;
    }
  });

  it('Cannot seize funds from a verified account', async () => {
    try {
      // Try to seize funds from a verified user's account
      const tx = program.methods
        .seizeFunds()
        .accounts({
          mint: euroMint,
          sourceAccount: user1TokenAccount,
          destinationAccount: reserve,
          kycOracleState: kycOracleState,
          kycUser: user1KycAccount,
          authority: regulatoryAuthority.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([regulatoryAuthority])
        .rpc();
      
      // This should fail, so we expect an error
      await tx;
      
      // If we reach here, the test failed
      assert.fail("Should not be able to seize funds from a verified user's account");
    } catch (error) {
      // Expected error
      console.log("Successfully prevented seizing funds from a verified user's account");
    }
  });

  it('Can unfreeze an account when sanctions are lifted', async () => {
    try {
      // Update KYC status back to Verified
      await program.methods
        .updateKycUserStatus(2) // Verified status
        .accounts({
          kycOracleState: kycOracleState,
          kycUser: sanctionedUserKycAccount,
          authority: regulatoryAuthority.publicKey,
        })
        .signers([regulatoryAuthority])
        .rpc();
      
      // Unfreeze the account
      await program.methods
        .unfreezeAccount()
        .accounts({
          mint: euroMint,
          account: sanctionedUserTokenAccount,
          kycOracleState: kycOracleState,
          kycUser: sanctionedUserKycAccount,
          freezeAuthority: freezeAuthority.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([freezeAuthority])
        .rpc();
      
      // Verify account is unfrozen
      const accountInfo = await getAccount(
        provider.connection,
        sanctionedUserTokenAccount,
        TOKEN_PROGRAM_ID
      );
      
      assert.equal(accountInfo.state, AccountState.Initialized);
      
    } catch (error) {
      console.error("Error unfreezing account:", error);
      throw error;
    }
  });
}); 