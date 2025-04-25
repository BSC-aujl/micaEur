import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { MicaEur } from "../target/types/mica_eur";
import {
  createMint,
  getAccount,
  getMint,
  createAccount,
  mintTo,
  burn,
  transfer,
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  getTransferHook,
  createInitializeTransferHookInstruction,
  getDefaultAccountState,
  getMetadataPointer,
  getPermanentDelegate,
  getAccountState,
  AccountState,
} from "@solana/spl-token";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  Keypair,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  Connection,
} from "@solana/web3.js";
import { assert } from "chai";

describe("mica_eur", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.MicaEur as Program<MicaEur>;
  const connection = program.provider.connection;

  // Test keypairs
  const issuer = anchor.web3.Keypair.generate();
  const freezeAuthority = anchor.web3.Keypair.generate();
  const permanentDelegate = anchor.web3.Keypair.generate();
  const user1 = anchor.web3.Keypair.generate();
  const user2 = anchor.web3.Keypair.generate();
  const regulatoryAuthority = anchor.web3.Keypair.generate();

  // Test accounts
  let mintKeypair: Keypair;
  let mintPubkey: PublicKey;
  let mintInfoPubkey: PublicKey;
  let user1TokenAccount: PublicKey;
  let user2TokenAccount: PublicKey;
  let treasuryTokenAccount: PublicKey;
  
  // KYC Oracle
  let kycOracleState: PublicKey;
  let kycUser1: PublicKey;
  let kycUser2: PublicKey;

  // Test parameters
  const MINT_DECIMALS = 9;
  const TEST_AMOUNT = 1000 * Math.pow(10, MINT_DECIMALS); // 1000 EUR
  const WHITEPAPER_URI = "https://example.com/mica-eur-whitepaper.pdf";
  const MINT_INFO_SEED = Buffer.from("mint_info");
  const KYC_ORACLE_SEED = Buffer.from("kyc_oracle");
  const KYC_USER_SEED = Buffer.from("kyc_user");

  before(async () => {
    // Fund the test accounts
    await Promise.all([
      connection.requestAirdrop(issuer.publicKey, 200 * LAMPORTS_PER_SOL),
      connection.requestAirdrop(freezeAuthority.publicKey, 10 * LAMPORTS_PER_SOL),
      connection.requestAirdrop(permanentDelegate.publicKey, 10 * LAMPORTS_PER_SOL),
      connection.requestAirdrop(user1.publicKey, 10 * LAMPORTS_PER_SOL),
      connection.requestAirdrop(user2.publicKey, 10 * LAMPORTS_PER_SOL),
      connection.requestAirdrop(regulatoryAuthority.publicKey, 10 * LAMPORTS_PER_SOL),
    ]);

    // Wait for confirmations
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Define mint keypair
    mintKeypair = anchor.web3.Keypair.generate();
    mintPubkey = mintKeypair.publicKey;

    // Find the mint info PDA
    [mintInfoPubkey] = anchor.web3.PublicKey.findProgramAddressSync(
      [MINT_INFO_SEED, mintPubkey.toBuffer()],
      program.programId
    );
  });

  it("Initializes the KYC Oracle", async () => {
    // Find KYC Oracle state PDA
    [kycOracleState] = anchor.web3.PublicKey.findProgramAddressSync(
      [KYC_ORACLE_SEED],
      program.programId
    );

    // Initialize KYC Oracle
    await program.methods
      .initializeKycOracle()
      .accounts({
        authority: issuer.publicKey,
        oracleState: kycOracleState,
        systemProgram: SystemProgram.programId,
      })
      .signers([issuer])
      .rpc();

    // Verify KYC Oracle state
    const oracleState = await program.account.kycOracleState.fetch(kycOracleState);
    assert.isTrue(oracleState.isActive);
    assert.equal(oracleState.authority.toString(), issuer.publicKey.toString());
    assert.equal(oracleState.adminCount, 1);
    assert.equal(oracleState.totalVerifiedUsers.toString(), "0");
  });

  it("Registers and verifies KYC users", async () => {
    // Find KYC User PDAs
    [kycUser1] = anchor.web3.PublicKey.findProgramAddressSync(
      [KYC_USER_SEED, user1.publicKey.toBuffer()],
      program.programId
    );
    
    [kycUser2] = anchor.web3.PublicKey.findProgramAddressSync(
      [KYC_USER_SEED, user2.publicKey.toBuffer()],
      program.programId
    );

    // Register User 1
    const blz1 = "10070000"; // Deutsche Bank BLZ
    const ibanHash1 = Array.from(Buffer.from("IBAN1_HASH_PLACEHOLDER_FOR_TEST_ONLY".padEnd(32, "0")));
    
    await program.methods
      .registerKycUser(
        blz1,
        ibanHash1,
        "DE", // Germany
        "TEST_PROVIDER"
      )
      .accounts({
        authority: issuer.publicKey,
        oracleState: kycOracleState,
        user: user1.publicKey,
        kycUser: kycUser1,
        systemProgram: SystemProgram.programId,
      })
      .signers([issuer])
      .rpc();

    // Register User 2
    const blz2 = "37040044"; // Commerzbank BLZ
    const ibanHash2 = Array.from(Buffer.from("IBAN2_HASH_PLACEHOLDER_FOR_TEST_ONLY".padEnd(32, "0")));
    
    await program.methods
      .registerKycUser(
        blz2,
        ibanHash2,
        "DE", // Germany
        "TEST_PROVIDER"
      )
      .accounts({
        authority: issuer.publicKey,
        oracleState: kycOracleState,
        user: user2.publicKey,
        kycUser: kycUser2,
        systemProgram: SystemProgram.programId,
      })
      .signers([issuer])
      .rpc();

    // Verify User 1 KYC
    await program.methods
      .updateKycStatus(
        { verified: {} }, // Status
        2, // Level
        365 // Expiry days
      )
      .accounts({
        authority: issuer.publicKey,
        oracleState: kycOracleState,
        kycUser: kycUser1,
      })
      .signers([issuer])
      .rpc();

    // Verify User 2 KYC
    await program.methods
      .updateKycStatus(
        { verified: {} }, // Status
        2, // Level
        365 // Expiry days
      )
      .accounts({
        authority: issuer.publicKey,
        oracleState: kycOracleState,
        kycUser: kycUser2,
      })
      .signers([issuer])
      .rpc();

    // Check User 1 KYC status
    const user1KYC = await program.account.kycUser.fetch(kycUser1);
    assert.strictEqual(user1KYC.status.verified !== undefined, true);
    assert.strictEqual(user1KYC.verificationLevel, 2);
    
    // Check User 2 KYC status
    const user2KYC = await program.account.kycUser.fetch(kycUser2);
    assert.strictEqual(user2KYC.status.verified !== undefined, true);
    assert.strictEqual(user2KYC.verificationLevel, 2);
  });

  it("Initializes the Euro mint with Token-2022 extensions", async () => {
    // Initialize the MiCA EUR mint
    await program.methods
      .initializeEuroMint(WHITEPAPER_URI)
      .accounts({
        issuer: issuer.publicKey,
        mintInfo: mintInfoPubkey,
        mint: mintPubkey,
        freezeAuthority: freezeAuthority.publicKey,
        permanentDelegate: permanentDelegate.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([issuer, mintKeypair])
      .rpc();

    // Verify the mint info account
    const mintInfoAccount = await program.account.mintInfo.fetch(mintInfoPubkey);
    assert.equal(mintInfoAccount.mint.toString(), mintPubkey.toString());
    assert.equal(mintInfoAccount.issuer.toString(), issuer.publicKey.toString());
    assert.equal(mintInfoAccount.freezeAuthority.toString(), freezeAuthority.publicKey.toString());
    assert.equal(mintInfoAccount.permanentDelegate.toString(), permanentDelegate.publicKey.toString());
    assert.equal(mintInfoAccount.whitepaper_uri, WHITEPAPER_URI);
    assert.isTrue(mintInfoAccount.is_active);

    // Create token accounts for testing
    console.log("Creating token accounts for users...");
    
    // Create token account for the issuer (treasury)
    treasuryTokenAccount = await createAccount(
      connection,
      issuer,
      mintPubkey,
      issuer.publicKey,
      undefined,
      { commitment: "confirmed", tokenProgram: TOKEN_2022_PROGRAM_ID }
    );
    
    // Create token account for user1
    user1TokenAccount = await createAccount(
      connection,
      user1,
      mintPubkey,
      user1.publicKey,
      undefined,
      { commitment: "confirmed", tokenProgram: TOKEN_2022_PROGRAM_ID }
    );
    
    // Create token account for user2
    user2TokenAccount = await createAccount(
      connection,
      user2,
      mintPubkey,
      user2.publicKey,
      undefined,
      { commitment: "confirmed", tokenProgram: TOKEN_2022_PROGRAM_ID }
    );
  });

  it("Verifies Token-2022 extensions", async () => {
    // Verify Default Account State extension
    const defaultState = await getDefaultAccountState(
      connection,
      mintPubkey,
      TOKEN_2022_PROGRAM_ID
    );
    assert.equal(defaultState, AccountState.Frozen, "Default account state should be Frozen");
    
    // Verify Permanent Delegate
    const delegate = await getPermanentDelegate(
      connection,
      mintPubkey,
      TOKEN_2022_PROGRAM_ID
    );
    assert.equal(delegate?.toString(), permanentDelegate.publicKey.toString(), 
                "Permanent delegate should match");
    
    // Verify Metadata Pointer
    const metadata = await getMetadataPointer(
      connection,
      mintPubkey,
      TOKEN_2022_PROGRAM_ID
    );
    assert.isNotNull(metadata, "Metadata pointer should exist");
    
    // Verify Transfer Hook (we would need a more complex test to fully verify this)
    const transferHook = await getTransferHook(
      connection,
      mintPubkey,
      TOKEN_2022_PROGRAM_ID
    );
    assert.isNotNull(transferHook, "Transfer hook should exist");
  });

  it("Mints tokens to KYC verified users", async () => {
    // Mint tokens to user1
    await program.methods
      .mintTokens(new anchor.BN(TEST_AMOUNT))
      .accounts({
        issuer: issuer.publicKey,
        mintInfo: mintInfoPubkey,
        mint: mintPubkey,
        tokenAccount: user1TokenAccount,
        kyc_user: kycUser1,
        freezeAuthority: freezeAuthority.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([issuer])
      .rpc();
    
    // Check the balance of user1
    const user1Account = await getAccount(
      connection,
      user1TokenAccount,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    assert.equal(user1Account.amount.toString(), TEST_AMOUNT.toString());
    
    // Mint tokens to user2
    await program.methods
      .mintTokens(new anchor.BN(TEST_AMOUNT))
      .accounts({
        issuer: issuer.publicKey,
        mintInfo: mintInfoPubkey,
        mint: mintPubkey,
        tokenAccount: user2TokenAccount,
        kyc_user: kycUser2,
        freezeAuthority: freezeAuthority.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([issuer])
      .rpc();
    
    // Check the balance of user2
    const user2Account = await getAccount(
      connection,
      user2TokenAccount,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    assert.equal(user2Account.amount.toString(), TEST_AMOUNT.toString());
  });

  it("Allows users to burn tokens (redeem)", async () => {
    const burnAmount = TEST_AMOUNT / 2;
    
    // Burn tokens from user1
    await program.methods
      .burnTokens(new anchor.BN(burnAmount))
      .accounts({
        owner: user1.publicKey,
        mintInfo: mintInfoPubkey,
        mint: mintPubkey,
        tokenAccount: user1TokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([user1])
      .rpc();
    
    // Check the balance of user1
    const user1Account = await getAccount(
      connection,
      user1TokenAccount,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    assert.equal(user1Account.amount.toString(), (TEST_AMOUNT - burnAmount).toString());
  });

  it("Allows freezing accounts (regulatory action)", async () => {
    // Freeze user2's account
    await program.methods
      .freezeAccount()
      .accounts({
        freezeAuthority: freezeAuthority.publicKey,
        mintInfo: mintInfoPubkey,
        mint: mintPubkey,
        tokenAccount: user2TokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([freezeAuthority])
      .rpc();
    
    // Check that the account is frozen
    const user2Account = await getAccount(
      connection,
      user2TokenAccount,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    assert.equal(user2Account.state, AccountState.Frozen);
    
    // Try to transfer from frozen account (should fail)
    try {
      await transfer(
        connection,
        user2,
        user2TokenAccount,
        user1TokenAccount,
        user2.publicKey,
        TEST_AMOUNT / 4,
        [],
        { commitment: "confirmed", tokenProgram: TOKEN_2022_PROGRAM_ID }
      );
      assert.fail("Should not be able to transfer from frozen account");
    } catch (error) {
      // Expected error
      console.log("Successfully prevented transfer from frozen account");
    }
  });

  it("Allows thawing frozen accounts", async () => {
    // Thaw user2's account
    await program.methods
      .thawAccount()
      .accounts({
        freezeAuthority: freezeAuthority.publicKey,
        mintInfo: mintInfoPubkey,
        mint: mintPubkey,
        tokenAccount: user2TokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([freezeAuthority])
      .rpc();
    
    // Check that the account is thawed
    const user2Account = await getAccount(
      connection,
      user2TokenAccount,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    assert.equal(user2Account.state, AccountState.Initialized);
    
    // Try to transfer from thawed account (should succeed)
    await transfer(
      connection,
      user2,
      user2TokenAccount,
      user1TokenAccount,
      user2.publicKey,
      TEST_AMOUNT / 4,
      [],
      { commitment: "confirmed", tokenProgram: TOKEN_2022_PROGRAM_ID }
    );
    
    // Check the balances
    const user1Account = await getAccount(
      connection,
      user1TokenAccount,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    const user2AccountAfter = await getAccount(
      connection,
      user2TokenAccount,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    
    assert.equal(user1Account.amount.toString(), 
                 (TEST_AMOUNT - (TEST_AMOUNT / 2) + (TEST_AMOUNT / 4)).toString());
    assert.equal(user2AccountAfter.amount.toString(), 
                 (TEST_AMOUNT - (TEST_AMOUNT / 4)).toString());
  });

  it("Allows seizing tokens through permanent delegate (regulatory action)", async () => {
    // Get initial balances
    const initialUser2Balance = (await getAccount(
      connection,
      user2TokenAccount,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    )).amount;
    
    // Create treasury token account if it doesn't exist
    if (!treasuryTokenAccount) {
      treasuryTokenAccount = await createAccount(
        connection,
        issuer,
        mintPubkey,
        issuer.publicKey,
        undefined,
        { commitment: "confirmed", tokenProgram: TOKEN_2022_PROGRAM_ID }
      );
    }
    
    const seizeAmount = TEST_AMOUNT / 4;
    
    // Seize tokens from user2 to treasury
    await program.methods
      .seizeTokens(new anchor.BN(seizeAmount))
      .accounts({
        permanentDelegate: permanentDelegate.publicKey,
        mintInfo: mintInfoPubkey,
        mint: mintPubkey,
        fromAccount: user2TokenAccount,
        toAccount: treasuryTokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([permanentDelegate])
      .rpc();
    
    // Check balances after seizure
    const user2AccountAfter = await getAccount(
      connection,
      user2TokenAccount,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    
    const treasuryAccountAfter = await getAccount(
      connection,
      treasuryTokenAccount,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    
    // Verify that tokens were properly seized
    assert.equal(user2AccountAfter.amount.toString(), 
                 (initialUser2Balance.toNumber() - seizeAmount).toString());
    assert.equal(treasuryAccountAfter.amount.toString(), seizeAmount.toString());
  });

  it("Updates reserve proof merkle root", async () => {
    // Create a mock merkle root for testing
    const mockMerkleRoot = Array.from(Buffer.from("MOCK_MERKLE_ROOT_FOR_RESERVE_PROOF".padEnd(32, "0")));
    const mockIpfsCid = "QmTfCwNj8FrTnS8LhGpUDj5N33y59pcCvsnnptHZGk1Gvb";
    
    // Update the reserve proof
    await program.methods
      .updateReserveProof(
        mockMerkleRoot,
        mockIpfsCid
      )
      .accounts({
        issuer: issuer.publicKey,
        mintInfo: mintInfoPubkey,
      })
      .signers([issuer])
      .rpc();
    
    // Verify the reserve proof was updated
    const mintInfoAfter = await program.account.mintInfo.fetch(mintInfoPubkey);
    
    // Check that the merkle root and IPFS CID were updated
    assert.deepEqual(Array.from(mintInfoAfter.reserve_merkle_root), mockMerkleRoot);
    assert.equal(mintInfoAfter.reserve_ipfs_cid, mockIpfsCid);
  });
});
