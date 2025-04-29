import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { MicaEur } from '../../target/types/mica_eur';
import { Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { 
  TOKEN_2022_PROGRAM_ID, 
  createMint, 
  createAccount, 
  mintTo, 
  transfer,
  getAccount,
  getAssociatedTokenAddressSync
} from '@solana/spl-token';
import { expect } from 'chai';

describe('Reserve Backing Functional Tests', () => {
  // Configure the client
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  
  // Placeholder for program ID
  const program = anchor.workspace.MicaEur as Program<MicaEur>;
  
  // Constants for reserve proof requirements
  const RESERVE_RATIO_PERCENT = 100; // 100% = 1:1 backing
  const RESERVE_REPORTING_INTERVAL = 86400; // 24 hours in seconds
  const MIN_REDEMPTION_AMOUNT = new anchor.BN(100).mul(new anchor.BN(10).pow(new anchor.BN(6))); // 100 EUR minimum
  const MAX_REDEMPTION_TIME = 86400; // 24 hours max redemption time
  
  // Define keypairs for the test
  const reserveAuthority = Keypair.generate();
  const issuer = Keypair.generate();
  const auditor = Keypair.generate();
  const regulatoryAuthority = Keypair.generate();
  const user1 = Keypair.generate();
  const user2 = Keypair.generate();
  
  // Reserve PDA and mint state
  let reserveStatePda: PublicKey;
  let reserveVaultPda: PublicKey;
  let mintPda: PublicKey;
  let mintAuthorityPda: PublicKey;
  let user1Ata: PublicKey;
  let user2Ata: PublicKey;

  before(async () => {
    // Fund accounts for gas
    const fundingTx = new anchor.web3.Transaction();
    
    [reserveAuthority, issuer, auditor, regulatoryAuthority, user1, user2].forEach(keypair => {
      fundingTx.add(
        SystemProgram.transfer({
          fromPubkey: provider.wallet.publicKey,
          toPubkey: keypair.publicKey,
          lamports: 10_000_000_000, // 10 SOL
        })
      );
    });
    
    await provider.sendAndConfirm(fundingTx);
    
    console.log("Test accounts funded");
    
    // Find PDAs for reserve state and mint authority
    [reserveStatePda] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("reserve_state")],
      program.programId
    );
    
    [reserveVaultPda] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("reserve_vault")],
      program.programId
    );
    
    [mintPda] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("mica_eur_mint")],
      program.programId
    );
    
    [mintAuthorityPda] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("mint_authority")],
      program.programId
    );
    
    // Get associated token accounts for users
    user1Ata = getAssociatedTokenAddressSync(
      mintPda,
      user1.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );
    
    user2Ata = getAssociatedTokenAddressSync(
      mintPda,
      user2.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );
    
    console.log("PDAs and ATAs initialized");
  });

  it('Initializes the reserve state with proper requirements', async () => {
    // Initialize reserve state
    await program.methods.initializeReserve({
      reserveRatioPercent: RESERVE_RATIO_PERCENT,
      reportingInterval: RESERVE_REPORTING_INTERVAL,
      minRedemptionAmount: MIN_REDEMPTION_AMOUNT,
      maxRedemptionTime: MAX_REDEMPTION_TIME
    })
    .accounts({
      reserveState: reserveStatePda,
      reserveVault: reserveVaultPda,
      reserveAuthority: reserveAuthority.publicKey,
      issuer: issuer.publicKey,
      auditor: auditor.publicKey,
      regulatoryAuthority: regulatoryAuthority.publicKey,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY
    })
    .signers([reserveAuthority])
    .rpc();
    
    // Fetch and verify reserve state
    const reserveState = await program.account.reserveState.fetch(reserveStatePda);
    
    expect(reserveState.reserveRatioPercent).to.equal(RESERVE_RATIO_PERCENT);
    expect(reserveState.reportingInterval).to.equal(RESERVE_REPORTING_INTERVAL);
    expect(reserveState.minRedemptionAmount.toString()).to.equal(MIN_REDEMPTION_AMOUNT.toString());
    expect(reserveState.maxRedemptionTime).to.equal(MAX_REDEMPTION_TIME);
    expect(reserveState.totalSupply.toString()).to.equal('0');
    expect(reserveState.totalReserves.toString()).to.equal('0');
    
    console.log("Reserve state initialized with 100% backing ratio requirement");
  });

  it('Logs fiat deposit to the reserve', async () => {
    const fiatAmount = new anchor.BN(1_000_000).mul(new anchor.BN(10).pow(new anchor.BN(6))); // 1,000,000 EUR
    const txReference = "FIAT-TX-123456789";
    
    await program.methods.logFiatDeposit(
      fiatAmount,
      txReference
    )
    .accounts({
      reserveState: reserveStatePda,
      reserveAuthority: reserveAuthority.publicKey,
    })
    .signers([reserveAuthority])
    .rpc();
    
    // Verify reserve state after fiat deposit
    const reserveState = await program.account.reserveState.fetch(reserveStatePda);
    
    expect(reserveState.totalReserves.toString()).to.equal(fiatAmount.toString());
    expect(reserveState.totalSupply.toString()).to.equal('0');
    expect(reserveState.lastDepositReference).to.equal(txReference);
    
    console.log(`Fiat deposit of ${fiatAmount.toString()} EUR logged to reserve`);
  });

  it('Mints tokens only up to reserve balance (1:1 backing)', async () => {
    // Get current reserve state
    const reserveStateBefore = await program.account.reserveState.fetch(reserveStatePda);
    const reserveBalance = reserveStateBefore.totalReserves;
    
    // Calculate mint amount to maintain 1:1 backing
    const mintAmount = reserveBalance.div(new anchor.BN(2)); // Mint half of the reserve
    
    // Initialize token mint if not already done
    await program.methods.initializeMint()
    .accounts({
      mint: mintPda,
      mintAuthority: mintAuthorityPda,
      reserveState: reserveStatePda,
      issuer: issuer.publicKey,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY
    })
    .signers([issuer])
    .rpc();
    
    console.log("Token mint initialized");
    
    // Mint tokens to user1
    await program.methods.mintTokens(mintAmount)
    .accounts({
      mint: mintPda,
      mintAuthority: mintAuthorityPda,
      reserveState: reserveStatePda,
      userAccount: user1Ata,
      issuer: issuer.publicKey,
      tokenProgram: TOKEN_2022_PROGRAM_ID
    })
    .signers([issuer])
    .rpc();
    
    // Verify token balance and reserve state
    const userTokenAccount = await getAccount(provider.connection, user1Ata, undefined, TOKEN_2022_PROGRAM_ID);
    const reserveStateAfter = await program.account.reserveState.fetch(reserveStatePda);
    
    expect(userTokenAccount.amount.toString()).to.equal(mintAmount.toString());
    expect(reserveStateAfter.totalSupply.toString()).to.equal(mintAmount.toString());
    
    // Verify reserve ratio is still 1:1 or better
    const reserveRatio = parseInt(reserveStateAfter.totalReserves.toString()) / parseInt(reserveStateAfter.totalSupply.toString());
    expect(reserveRatio).to.be.at.least(1.0);
    
    console.log(`${mintAmount.toString()} tokens minted to user1`);
    console.log(`Current reserve ratio: ${reserveRatio}`);
  });

  it('Prevents minting beyond available reserves', async () => {
    // Get current reserve state
    const reserveState = await program.account.reserveState.fetch(reserveStatePda);
    const availableReserve = reserveState.totalReserves.sub(reserveState.totalSupply);
    
    // Try to mint more than available (should fail)
    const excessMintAmount = availableReserve.add(new anchor.BN(1000).mul(new anchor.BN(10).pow(new anchor.BN(6))));
    
    try {
      await program.methods.mintTokens(excessMintAmount)
      .accounts({
        mint: mintPda,
        mintAuthority: mintAuthorityPda,
        reserveState: reserveStatePda,
        userAccount: user2Ata,
        issuer: issuer.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID
      })
      .signers([issuer])
      .rpc();
      
      // Should not reach here
      expect.fail('Minting beyond reserves should have failed');
    } catch (error) {
      console.log('Successfully prevented minting beyond available reserves');
    }
    
    // Mint right up to the limit (should succeed)
    await program.methods.mintTokens(availableReserve)
    .accounts({
      mint: mintPda,
      mintAuthority: mintAuthorityPda,
      reserveState: reserveStatePda,
      userAccount: user2Ata,
      issuer: issuer.publicKey,
      tokenProgram: TOKEN_2022_PROGRAM_ID
    })
    .signers([issuer])
    .rpc();
    
    // Verify token balance and reserve state
    const user2TokenAccount = await getAccount(provider.connection, user2Ata, undefined, TOKEN_2022_PROGRAM_ID);
    const reserveStateAfter = await program.account.reserveState.fetch(reserveStatePda);
    
    expect(user2TokenAccount.amount.toString()).to.equal(availableReserve.toString());
    expect(reserveStateAfter.totalSupply.toString()).to.equal(reserveStateAfter.totalReserves.toString());
    
    // Verify reserve ratio is exactly 1:1
    const reserveRatio = parseInt(reserveStateAfter.totalReserves.toString()) / parseInt(reserveStateAfter.totalSupply.toString());
    expect(reserveRatio).to.equal(1.0);
    
    console.log(`${availableReserve.toString()} tokens minted to user2 (maximum allowed by reserves)`);
    console.log(`Final reserve ratio: ${reserveRatio}`);
  });

  it('Generates reserve proof for regulatory reporting', async () => {
    // Generate reserve proof
    await program.methods.generateReserveProof()
    .accounts({
      reserveState: reserveStatePda,
      auditor: auditor.publicKey,
    })
    .signers([auditor])
    .rpc();
    
    // Verify proof was generated
    const reserveState = await program.account.reserveState.fetch(reserveStatePda);
    
    expect(reserveState.lastProofTimestamp.toString()).to.not.equal('0');
    expect(reserveState.lastAuditor.toString()).to.equal(auditor.publicKey.toString());
    
    // Calculate and verify the reserve ratio
    const reserveRatio = parseInt(reserveState.totalReserves.toString()) / parseInt(reserveState.totalSupply.toString());
    expect(reserveRatio).to.be.at.least(1.0);
    
    console.log(`Reserve proof generated by auditor at timestamp: ${reserveState.lastProofTimestamp.toString()}`);
    console.log(`Verified reserve ratio: ${reserveRatio}`);
  });

  it('Updates reserve state after token redemption', async () => {
    // Get current reserve state
    const reserveStateBefore = await program.account.reserveState.fetch(reserveStatePda);
    
    // Redeem some tokens from user1
    const redemptionAmount = new anchor.BN(100_000).mul(new anchor.BN(10).pow(new anchor.BN(6))); // 100,000 EUR
    const redemptionReference = "REDEMPTION-TX-987654321";
    
    await program.methods.redeemTokens(redemptionAmount, redemptionReference)
    .accounts({
      mint: mintPda,
      userAccount: user1Ata,
      reserveState: reserveStatePda,
      user: user1.publicKey,
      tokenProgram: TOKEN_2022_PROGRAM_ID
    })
    .signers([user1])
    .rpc();
    
    // Verify token balance and reserve state
    const userTokenAccount = await getAccount(provider.connection, user1Ata, undefined, TOKEN_2022_PROGRAM_ID);
    const reserveStateAfter = await program.account.reserveState.fetch(reserveStatePda);
    
    // Calculate expected values
    const expectedUserBalance = new anchor.BN(reserveStateBefore.totalSupply.toString()).div(new anchor.BN(2)).sub(redemptionAmount);
    const expectedTotalSupply = new anchor.BN(reserveStateBefore.totalSupply.toString()).sub(redemptionAmount);
    
    expect(userTokenAccount.amount.toString()).to.equal(expectedUserBalance.toString());
    expect(reserveStateAfter.totalSupply.toString()).to.equal(expectedTotalSupply.toString());
    expect(reserveStateAfter.lastRedemptionReference).to.equal(redemptionReference);
    
    // Verify reserve ratio is still 1:1 or better
    const reserveRatio = parseInt(reserveStateAfter.totalReserves.toString()) / parseInt(reserveStateAfter.totalSupply.toString());
    expect(reserveRatio).to.be.at.least(1.0);
    
    console.log(`${redemptionAmount.toString()} tokens redeemed from user1`);
    console.log(`New reserve ratio after redemption: ${reserveRatio}`);
  });

  it('Logs fiat withdrawal from reserve after redemption period', async () => {
    // Get current reserve state
    const reserveStateBefore = await program.account.reserveState.fetch(reserveStatePda);
    
    // Simulate redemption processing period (would normally wait MAX_REDEMPTION_TIME)
    console.log("In a real implementation, we would wait for the redemption period to complete");
    
    // Process fiat withdrawal for previously redeemed tokens
    const redemptionAmount = new anchor.BN(100_000).mul(new anchor.BN(10).pow(new anchor.BN(6))); // 100,000 EUR
    const withdrawalReference = "FIAT-WITHDRAWAL-TX-123123123";
    
    await program.methods.logFiatWithdrawal(
      redemptionAmount,
      withdrawalReference
    )
    .accounts({
      reserveState: reserveStatePda,
      reserveAuthority: reserveAuthority.publicKey,
    })
    .signers([reserveAuthority])
    .rpc();
    
    // Verify reserve state after fiat withdrawal
    const reserveStateAfter = await program.account.reserveState.fetch(reserveStatePda);
    
    // Expected reserve balance after withdrawal
    const expectedReserves = new anchor.BN(reserveStateBefore.totalReserves.toString()).sub(redemptionAmount);
    
    expect(reserveStateAfter.totalReserves.toString()).to.equal(expectedReserves.toString());
    expect(reserveStateAfter.lastWithdrawalReference).to.equal(withdrawalReference);
    
    // Verify reserve ratio is still 1:1 or better
    const reserveRatio = parseInt(reserveStateAfter.totalReserves.toString()) / parseInt(reserveStateAfter.totalSupply.toString());
    expect(reserveRatio).to.be.at.least(1.0);
    
    console.log(`${redemptionAmount.toString()} EUR withdrawn from reserve`);
    console.log(`Reserve ratio maintained at: ${reserveRatio}`);
  });

  it('Allows regulatory authority to review reserve state', async () => {
    // Regulatory review of reserve state
    await program.methods.regulatoryReview()
    .accounts({
      reserveState: reserveStatePda,
      regulatoryAuthority: regulatoryAuthority.publicKey,
    })
    .signers([regulatoryAuthority])
    .rpc();
    
    // Verify regulatory review was recorded
    const reserveState = await program.account.reserveState.fetch(reserveStatePda);
    
    expect(reserveState.lastRegulatoryReviewTimestamp.toString()).to.not.equal('0');
    
    // Calculate and verify the reserve ratio
    const reserveRatio = parseInt(reserveState.totalReserves.toString()) / parseInt(reserveState.totalSupply.toString());
    expect(reserveRatio).to.be.at.least(1.0);
    
    console.log(`Regulatory review completed at timestamp: ${reserveState.lastRegulatoryReviewTimestamp.toString()}`);
    console.log(`Verified compliance with 1:1 backing requirement`);
  });
}); 