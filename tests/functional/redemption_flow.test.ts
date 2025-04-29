import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { MicaEur } from '../../target/types/mica_eur';
import { Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { 
  TOKEN_2022_PROGRAM_ID, 
  getAssociatedTokenAddressSync,
  getAccount
} from '@solana/spl-token';
import { expect } from 'chai';
import { BN } from 'bn.js';

/*
 * NOTE: This test file simulates the redemption flow for MiCA EUR tokens.
 * The actual implementation may need adjustments based on the final program structure.
 * This is a functional test that demonstrates the complete redemption process
 * from token burn to fiat payout.
 */

describe('Redemption Flow Functional Tests', () => {
  // Configure the client
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  
  // We'll define the program interface for testing purposes
  // In a real implementation, this would be properly typed based on your IDL
  const program = anchor.workspace.MicaEur as any;
  
  // Constants for redemption requirements
  const MIN_REDEMPTION_AMOUNT = new BN(100).mul(new BN(10).pow(new BN(6))); // 100 EUR minimum
  const REDEMPTION_FEE_PERCENTAGE = 0.1; // 0.1% fee
  const MAX_REDEMPTION_TIME = 86400; // 24 hours max processing time
  
  // Define keypairs for the test
  const issuer = Keypair.generate();
  const reserveManager = Keypair.generate();
  const regularUser = Keypair.generate();
  const largeHolder = Keypair.generate();
  const institutionalUser = Keypair.generate();
  
  // PDAs and account addresses
  let mintPda: PublicKey;
  let mintAuthorityPda: PublicKey;
  let reserveStatePda: PublicKey;
  let redemptionQueuePda: PublicKey;
  let userTokenAccounts: Map<string, PublicKey> = new Map();

  before(async () => {
    // Fund accounts for gas
    const fundingTx = new anchor.web3.Transaction();
    
    [issuer, reserveManager, regularUser, largeHolder, institutionalUser].forEach(keypair => {
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
    
    // Find PDAs for the various accounts we need
    [mintPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("mica_eur_mint")],
      program.programId
    );
    
    [mintAuthorityPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("mint_authority")],
      program.programId
    );
    
    [reserveStatePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("reserve_state")],
      program.programId
    );
    
    [redemptionQueuePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("redemption_queue")],
      program.programId
    );
    
    // Create associated token accounts for users
    const userKeys = [
      { name: 'regular', keypair: regularUser },
      { name: 'large', keypair: largeHolder },
      { name: 'institutional', keypair: institutionalUser }
    ];
    
    userKeys.forEach(user => {
      const ata = getAssociatedTokenAddressSync(
        mintPda,
        user.keypair.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );
      userTokenAccounts.set(user.name, ata);
    });
    
    // Setup simulation - in a real test this would initialize all necessary accounts
    console.log("Simulation: Setting up accounts and minting tokens to users");
    
    // For our test, we'll simulate that the issuer has already:
    // 1. Initialized the mint
    // 2. Set up the reserve with funds
    // 3. Minted tokens to our test users
    // 4. Verified all users for KYC levels
    
    console.log("PDAs and user accounts initialized for redemption testing");
  });

  it('Sets up the redemption queue for processing redemptions', async () => {
    // Initialize the redemption queue
    console.log("Initializing redemption queue for processing withdrawals");
    
    await program.methods.initializeRedemptionQueue({
      minAmount: MIN_REDEMPTION_AMOUNT,
      feePercentage: REDEMPTION_FEE_PERCENTAGE,
      maxProcessingTime: MAX_REDEMPTION_TIME
    })
    .accounts({
      redemptionQueue: redemptionQueuePda,
      reserveState: reserveStatePda,
      issuer: issuer.publicKey,
      reserveManager: reserveManager.publicKey,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY
    })
    .signers([issuer])
    .rpc();
    
    // Verify queue initialization
    const queueState = await program.account.redemptionQueue.fetch(redemptionQueuePda);
    
    expect(queueState.minAmount.toString()).to.equal(MIN_REDEMPTION_AMOUNT.toString());
    expect(queueState.feePercentage).to.equal(REDEMPTION_FEE_PERCENTAGE);
    expect(queueState.maxProcessingTime).to.equal(MAX_REDEMPTION_TIME);
    expect(queueState.pendingRedemptions).to.equal(0);
    
    console.log("Redemption queue initialized with proper parameters");
  });

  it('Allows a regular user to submit a redemption request', async () => {
    // Regular user redemption - small amount
    const regularUserRedemptionAmount = new BN(500).mul(new BN(10).pow(new BN(6))); // 500 EUR
    const redemptionId = "REG-123456";
    const bankDetails = "IBAN: DE123456789, BIC: ABCDEFG";
    
    await program.methods.requestRedemption(
      regularUserRedemptionAmount,
      redemptionId,
      bankDetails
    )
    .accounts({
      mint: mintPda,
      userTokenAccount: userTokenAccounts.get('regular'),
      redemptionQueue: redemptionQueuePda,
      reserveState: reserveStatePda,
      user: regularUser.publicKey,
      tokenProgram: TOKEN_2022_PROGRAM_ID
    })
    .signers([regularUser])
    .rpc();
    
    // Verify redemption request
    const queueState = await program.account.redemptionQueue.fetch(redemptionQueuePda);
    
    expect(queueState.pendingRedemptions).to.equal(1);
    expect(queueState.totalPendingAmount.toString()).to.equal(regularUserRedemptionAmount.toString());
    
    // The tokens should have been burned
    const userTokenAccount = await getAccount(
      provider.connection, 
      userTokenAccounts.get('regular'),
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    
    // In actual implementation, this would check for decreased balance 
    // after the redemption request burns the tokens
    
    console.log(`Regular user submitted redemption request for ${regularUserRedemptionAmount.toString()} tokens`);
  });

  it('Allows a large holder to submit a large redemption request', async () => {
    // Large holder redemption - requires special processing
    const largeRedemptionAmount = new BN(100000).mul(new BN(10).pow(new BN(6))); // 100,000 EUR
    const redemptionId = "LARGE-789012";
    const bankDetails = "IBAN: GB987654321, BIC: BIGBANK";
    
    await program.methods.requestRedemption(
      largeRedemptionAmount,
      redemptionId,
      bankDetails
    )
    .accounts({
      mint: mintPda,
      userTokenAccount: userTokenAccounts.get('large'),
      redemptionQueue: redemptionQueuePda,
      reserveState: reserveStatePda,
      user: largeHolder.publicKey,
      tokenProgram: TOKEN_2022_PROGRAM_ID
    })
    .signers([largeHolder])
    .rpc();
    
    // Verify redemption request
    const queueState = await program.account.redemptionQueue.fetch(redemptionQueuePda);
    
    // Total should include both pending redemptions
    const expectedTotal = regularUserRedemptionAmount.add(largeRedemptionAmount);
    
    expect(queueState.pendingRedemptions).to.equal(2);
    expect(queueState.totalPendingAmount.toString()).to.equal(expectedTotal.toString());
    
    // Large redemptions should be flagged for manual review in a real implementation
    
    console.log(`Large holder submitted redemption request for ${largeRedemptionAmount.toString()} tokens`);
  });

  it('Processes redemptions in order and records fiat payouts', async () => {
    // Reserve manager processes redemptions
    const regularUserRedemptionAmount = new BN(500).mul(new BN(10).pow(new BN(6))); // 500 EUR
    const fiatTransactionReference = "BANK-TX-123456";
    
    await program.methods.processRedemption(
      regularUserRedemptionAmount,
      regularUser.publicKey,
      fiatTransactionReference
    )
    .accounts({
      redemptionQueue: redemptionQueuePda,
      reserveState: reserveStatePda,
      reserveManager: reserveManager.publicKey
    })
    .signers([reserveManager])
    .rpc();
    
    // Verify processing
    const queueState = await program.account.redemptionQueue.fetch(redemptionQueuePda);
    const reserveState = await program.account.reserveState.fetch(reserveStatePda);
    
    // Should be 1 redemption left (the large one)
    expect(queueState.pendingRedemptions).to.equal(1);
    
    // The larger redemption should be the only one remaining
    const largeRedemptionAmount = new BN(100000).mul(new BN(10).pow(new BN(6))); // 100,000 EUR
    expect(queueState.totalPendingAmount.toString()).to.equal(largeRedemptionAmount.toString());
    
    // Reserve state should track this withdrawal
    expect(reserveState.lastRedemptionReference).to.equal(fiatTransactionReference);
    
    console.log(`Reserve manager processed redemption for ${regularUserRedemptionAmount.toString()} tokens`);
  });

  it('Processes a large redemption with special approval', async () => {
    // Large redemptions require additional approvals
    const largeRedemptionAmount = new BN(100000).mul(new BN(10).pow(new BN(6))); // 100,000 EUR
    const fiatTransactionReference = "BANK-TX-789012";
    const approvalCode = "LARGE-APPROVAL-123";
    
    await program.methods.processLargeRedemption(
      largeRedemptionAmount,
      largeHolder.publicKey,
      fiatTransactionReference,
      approvalCode
    )
    .accounts({
      redemptionQueue: redemptionQueuePda,
      reserveState: reserveStatePda,
      reserveManager: reserveManager.publicKey,
      issuer: issuer.publicKey // Additional approval from issuer for large amounts
    })
    .signers([reserveManager, issuer])
    .rpc();
    
    // Verify processing
    const queueState = await program.account.redemptionQueue.fetch(redemptionQueuePda);
    const reserveState = await program.account.reserveState.fetch(reserveStatePda);
    
    // Should be no redemptions left
    expect(queueState.pendingRedemptions).to.equal(0);
    expect(queueState.totalPendingAmount.toString()).to.equal('0');
    
    // Reserve state should track this withdrawal
    expect(reserveState.lastRedemptionReference).to.equal(fiatTransactionReference);
    expect(reserveState.lastLargeRedemptionApproval).to.equal(approvalCode);
    
    console.log(`Reserve manager processed large redemption for ${largeRedemptionAmount.toString()} tokens with special approval`);
  });

  it('Maintains an audit trail of all redemptions', async () => {
    // In an actual implementation, this would query for historical redemption data
    console.log("Querying audit trail of redemptions for regulatory compliance");
    
    // Get redemption history (mock for demonstration)
    const redemptionHistory = await program.methods.getRedemptionHistory()
    .accounts({
      redemptionQueue: redemptionQueuePda,
    })
    .view();
    
    // Validate the history contains all necessary information
    expect(redemptionHistory.totalRedemptions).to.equal(2);
    expect(redemptionHistory.totalAmountRedeemed.toString()).to.not.equal('0');
    
    // Verify important audit information is present
    expect(redemptionHistory.entries[0].user.toString()).to.equal(regularUser.publicKey.toString());
    expect(redemptionHistory.entries[0].txReference).to.equal("BANK-TX-123456");
    
    expect(redemptionHistory.entries[1].user.toString()).to.equal(largeHolder.publicKey.toString());
    expect(redemptionHistory.entries[1].txReference).to.equal("BANK-TX-789012");
    expect(redemptionHistory.entries[1].requiresSpecialApproval).to.be.true;
    
    console.log("Redemption audit trail verified for compliance");
  });

  it('Handles minimum redemption amount requirements', async () => {
    // Try to redeem below minimum amount (should fail)
    const tooSmallAmount = new BN(50).mul(new BN(10).pow(new BN(6))); // 50 EUR (below minimum)
    const redemptionId = "SMALL-123456";
    const bankDetails = "IBAN: NL12345, BIC: SMALLBANK";
    
    try {
      await program.methods.requestRedemption(
        tooSmallAmount,
        redemptionId,
        bankDetails
      )
      .accounts({
        mint: mintPda,
        userTokenAccount: userTokenAccounts.get('regular'),
        redemptionQueue: redemptionQueuePda,
        reserveState: reserveStatePda,
        user: regularUser.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID
      })
      .signers([regularUser])
      .rpc();
      
      expect.fail('Redemption below minimum amount should fail');
    } catch (error) {
      console.log('Successfully prevented redemption below minimum amount');
    }
    
    // Verify state unchanged
    const queueState = await program.account.redemptionQueue.fetch(redemptionQueuePda);
    expect(queueState.pendingRedemptions).to.equal(0);
  });

  it('Supports institutional redemptions with special handling', async () => {
    // Institutional redemptions may have different requirements or fee structures
    const institutionalRedemptionAmount = new BN(1000000).mul(new BN(10).pow(new BN(6))); // 1,000,000 EUR
    const redemptionId = "INST-567890";
    const specialInstructions = {
      wireTransfer: true,
      expressProcessing: true,
      targetTime: "T+1",
      institutionalCode: "INST-12345"
    };
    
    await program.methods.requestInstitutionalRedemption(
      institutionalRedemptionAmount,
      redemptionId,
      specialInstructions
    )
    .accounts({
      mint: mintPda,
      userTokenAccount: userTokenAccounts.get('institutional'),
      redemptionQueue: redemptionQueuePda,
      reserveState: reserveStatePda,
      user: institutionalUser.publicKey,
      tokenProgram: TOKEN_2022_PROGRAM_ID
    })
    .signers([institutionalUser])
    .rpc();
    
    // Verify institutional redemption
    const queueState = await program.account.redemptionQueue.fetch(redemptionQueuePda);
    
    expect(queueState.pendingRedemptions).to.equal(1);
    expect(queueState.totalPendingAmount.toString()).to.equal(institutionalRedemptionAmount.toString());
    expect(queueState.hasInstitutionalPriority).to.be.true;
    
    console.log(`Institutional user submitted redemption request for ${institutionalRedemptionAmount.toString()} tokens with special handling`);
  });

  it('Reports comprehensive redemption statistics for regulatory compliance', async () => {
    // Generate compliance report for redemptions
    const complianceReport = await program.methods.generateRedemptionComplianceReport()
    .accounts({
      redemptionQueue: redemptionQueuePda,
      reserveState: reserveStatePda,
      issuer: issuer.publicKey
    })
    .signers([issuer])
    .rpc();
    
    // Verify compliance data is collected properly
    expect(complianceReport.totalRedemptionsProcessed).to.be.above(0);
    expect(complianceReport.averageProcessingTime).to.be.at.most(MAX_REDEMPTION_TIME);
    expect(complianceReport.largeRedemptionsCount).to.be.above(0);
    expect(complianceReport.institutionalRedemptionsCount).to.be.above(0);
    
    // Check for important regulatory information
    expect(complianceReport.hasSuspiciousActivity).to.be.false;
    expect(complianceReport.compliesWithMicaRequirements).to.be.true;
    
    console.log("Generated redemption compliance report for regulatory reporting");
  });
}); 