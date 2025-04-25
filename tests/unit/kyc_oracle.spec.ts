import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";
import { getProgram } from "./test-helper";

// @ts-nocheck - Disable TypeScript errors while we're fixing the tests
describe("KYC Oracle Tests", () => {
  // Use an ephemeral keypair for testing
  const wallet = new anchor.Wallet(anchor.web3.Keypair.generate());
  const connection = new anchor.web3.Connection("http://localhost:8899", {
    commitment: "confirmed", 
  });
  
  // Configure the client to use the local cluster
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);
  
  // Use the helper to get a properly configured program instance
  const program = getProgram();

  // Test keypairs
  const authority = anchor.web3.Keypair.generate();
  const user1 = anchor.web3.Keypair.generate();
  const user2 = anchor.web3.Keypair.generate();
  const user3 = anchor.web3.Keypair.generate();

  // KYC Oracle
  let kycOracleState: PublicKey;
  let kycUser1: PublicKey;
  let kycUser2: PublicKey;
  let kycUser3: PublicKey;

  // Test data
  const blz1 = "10070000"; // Deutsche Bank BLZ
  const blz2 = "37040044"; // Commerzbank BLZ
  const blz3 = "12030000"; // DKB BLZ
  
  const ibanHash1 = Array.from(Buffer.from("DE89370400440532013000".padEnd(32, "0")));
  const ibanHash2 = Array.from(Buffer.from("DE27100777770209299700".padEnd(32, "0")));
  const ibanHash3 = Array.from(Buffer.from("DE23100900001234567890".padEnd(32, "0")));

  before(async () => {
    // Fund the test accounts
    await Promise.all([
      connection.requestAirdrop(authority.publicKey, 100 * LAMPORTS_PER_SOL),
      connection.requestAirdrop(user1.publicKey, 10 * LAMPORTS_PER_SOL),
      connection.requestAirdrop(user2.publicKey, 10 * LAMPORTS_PER_SOL),
      connection.requestAirdrop(user3.publicKey, 10 * LAMPORTS_PER_SOL),
    ]);

    // Wait for confirmations
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Find KYC Oracle state PDA
    [kycOracleState] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("kyc_oracle")],
      program.programId
    );

    // Find KYC User PDAs
    [kycUser1] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("kyc_user"), user1.publicKey.toBuffer()],
      program.programId
    );
    
    [kycUser2] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("kyc_user"), user2.publicKey.toBuffer()],
      program.programId
    );
    
    [kycUser3] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("kyc_user"), user3.publicKey.toBuffer()],
      program.programId
    );
  });

  it("Initializes the KYC Oracle", async () => {
    // Initialize KYC Oracle
    await program.methods
      .initializeKycOracle()
      .accounts({
        authority: authority.publicKey,
        oracleState: kycOracleState,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    // Verify KYC Oracle state
    const oracleState = await program.account.kycOracleState.fetch(kycOracleState);
    assert.isTrue(oracleState.isActive);
    assert.equal(oracleState.authority.toString(), authority.publicKey.toString());
    assert.equal(oracleState.adminCount, 1);
    assert.equal(oracleState.totalVerifiedUsers.toString(), "0");
  });

  it("Registers new KYC users", async () => {
    // Register User 1
    await program.methods
      .registerKycUser(
        blz1,
        ibanHash1,
        "DE", // Germany
        "VERIFF"
      )
      .accounts({
        authority: authority.publicKey,
        oracleState: kycOracleState,
        user: user1.publicKey,
        kycUser: kycUser1,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    // Register User 2
    await program.methods
      .registerKycUser(
        blz2,
        ibanHash2,
        "DE", // Germany
        "VERIFF"
      )
      .accounts({
        authority: authority.publicKey,
        oracleState: kycOracleState,
        user: user2.publicKey,
        kycUser: kycUser2,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    // Register User 3 with a different country code
    await program.methods
      .registerKycUser(
        blz3,
        ibanHash3,
        "AT", // Austria
        "VERIFF"
      )
      .accounts({
        authority: authority.publicKey,
        oracleState: kycOracleState,
        user: user3.publicKey,
        kycUser: kycUser3,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    // Verify User 1 KYC data
    const user1KYC = await program.account.kycUser.fetch(kycUser1);
    assert.equal(user1KYC.user.toString(), user1.publicKey.toString());
    assert.equal(user1KYC.blz, blz1);
    assert.deepEqual(user1KYC.ibanHash, ibanHash1);
    assert.equal(user1KYC.countryCode, "DE");
    assert.equal(user1KYC.verificationLevel, 0);
    assert.equal(user1KYC.status.pending !== undefined, true);

    // Verify User 2 KYC data
    const user2KYC = await program.account.kycUser.fetch(kycUser2);
    assert.equal(user2KYC.user.toString(), user2.publicKey.toString());
    assert.equal(user2KYC.blz, blz2);
    assert.deepEqual(user2KYC.ibanHash, ibanHash2);
    assert.equal(user2KYC.countryCode, "DE");

    // Verify User 3 KYC data
    const user3KYC = await program.account.kycUser.fetch(kycUser3);
    assert.equal(user3KYC.user.toString(), user3.publicKey.toString());
    assert.equal(user3KYC.countryCode, "AT");
  });

  it("Updates KYC status for users", async () => {
    // Verify User 1 KYC with level 1
    await program.methods
      .updateKycStatus(
        { verified: {} }, // Status
        1, // Level - Basic
        180 // Expiry days (6 months)
      )
      .accounts({
        authority: authority.publicKey,
        oracleState: kycOracleState,
        kycUser: kycUser1,
      })
      .signers([authority])
      .rpc();

    // Verify User 2 KYC with level 2
    await program.methods
      .updateKycStatus(
        { verified: {} }, // Status
        2, // Level - Enhanced
        365 // Expiry days (1 year)
      )
      .accounts({
        authority: authority.publicKey,
        oracleState: kycOracleState,
        kycUser: kycUser2,
      })
      .signers([authority])
      .rpc();

    // Reject User 3 KYC
    await program.methods
      .updateKycStatus(
        { rejected: {} }, // Status
        0, // Level - None
        0 // Expiry days
      )
      .accounts({
        authority: authority.publicKey,
        oracleState: kycOracleState,
        kycUser: kycUser3,
      })
      .signers([authority])
      .rpc();

    // Check User 1 KYC status
    const user1KYC = await program.account.kycUser.fetch(kycUser1);
    assert.strictEqual(user1KYC.status.verified !== undefined, true);
    assert.strictEqual(user1KYC.verificationLevel, 1);
    assert.isTrue(user1KYC.expiryDate > user1KYC.verificationDate);
    
    // Check User 2 KYC status
    const user2KYC = await program.account.kycUser.fetch(kycUser2);
    assert.strictEqual(user2KYC.status.verified !== undefined, true);
    assert.strictEqual(user2KYC.verificationLevel, 2);
    assert.isTrue(user2KYC.expiryDate > user2KYC.verificationDate);
    
    // Check User 3 KYC status
    const user3KYC = await program.account.kycUser.fetch(kycUser3);
    assert.strictEqual(user3KYC.status.rejected !== undefined, true);
    assert.strictEqual(user3KYC.verificationLevel, 0);

    // Verify the total verified users count
    const oracleState = await program.account.kycOracleState.fetch(kycOracleState);
    assert.equal(oracleState.totalVerifiedUsers.toString(), "2");
  });

  it("Handles KYC expiry correctly", async () => {
    // Set User 1 to expired
    await program.methods
      .updateKycStatus(
        { verified: {} }, // Status
        1, // Level
        -1 // Expired (1 day in the past)
      )
      .accounts({
        authority: authority.publicKey,
        oracleState: kycOracleState,
        kycUser: kycUser1,
      })
      .signers([authority])
      .rpc();

    // Check User 1 KYC status
    const user1KYC = await program.account.kycUser.fetch(kycUser1);
    assert.strictEqual(user1KYC.status.verified !== undefined, true);
    assert.strictEqual(user1KYC.verificationLevel, 1);
    
    // Current time should be greater than expiry date
    const currentTime = Math.floor(Date.now() / 1000);
    assert.isTrue(currentTime > user1KYC.expiryDate);
  });
});
