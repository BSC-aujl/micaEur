/**
 * Helper functions for KYC provider management
 * 
 * These functions assist with registering and managing KYC providers,
 * as well as handling user KYC verifications.
 */

// Signature: ZHVtbXlfc2lnbmF0dXJlX2Zvcl9reWNfcHJvdmlkZXJfaGVscGVycw==

/* eslint-disable @typescript-eslint/no-explicit-any */
import { PublicKey, Keypair, SystemProgram } from '@solana/web3.js';
import { 
  TestContext, 
  KycProvider,
  KycUser,
  KycVerificationLevel
} from './types';

/**
 * Derives the PDA for a KYC provider
 */
export async function findKycProviderPDA(
  programId: PublicKey, 
  providerPublicKey: PublicKey
): Promise<PublicKey> {
  const [pda] = await PublicKey.findProgramAddress(
    [
      Buffer.from('kyc-provider'),
      providerPublicKey.toBuffer(),
    ],
    programId
  );
  return pda;
}

/**
 * Derives the PDA for a KYC user
 */
export async function findKycUserPDA(
  programId: PublicKey, 
  userPublicKey: PublicKey
): Promise<PublicKey> {
  const [pda] = await PublicKey.findProgramAddress(
    [
      Buffer.from('kyc-user'),
      userPublicKey.toBuffer(),
    ],
    programId
  );
  return pda;
}

/**
 * Registers a new KYC provider
 */
export async function registerKycProvider(
  context: TestContext,
  params: {
    name: string;
    jurisdiction: string;
    providerKeypair?: Keypair; // Optional: provide a specific keypair, otherwise one will be generated
  }
): Promise<PublicKey> {
  const providerKeypair = params.providerKeypair || Keypair.generate();
  const providerPDA = await findKycProviderPDA(
    context.program.programId,
    providerKeypair.publicKey
  );

  await context.program.methods
    .registerKycProvider(
      params.name,
      params.jurisdiction
    )
    .accounts({
      kycProvider: providerPDA,
      providerKey: providerKeypair.publicKey,
      authority: context.keypairs.authority.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([context.keypairs.authority, providerKeypair])
    .rpc();

  return providerPDA;
}

/**
 * Updates a KYC provider's information
 */
export async function updateKycProvider(
  context: TestContext,
  params: {
    providerPublicKey: PublicKey;
    name?: string;
    jurisdiction?: string;
  }
): Promise<void> {
  const providerPDA = await findKycProviderPDA(
    context.program.programId,
    params.providerPublicKey
  );

  await context.program.methods
    .updateKycProvider(
      params.name,
      params.jurisdiction
    )
    .accounts({
      kycProvider: providerPDA,
      authority: context.keypairs.authority.publicKey,
    })
    .signers([context.keypairs.authority])
    .rpc();
}

/**
 * Removes a KYC provider
 */
export async function removeKycProvider(
  context: TestContext,
  providerPublicKey: PublicKey
): Promise<void> {
  const providerPDA = await findKycProviderPDA(
    context.program.programId,
    providerPublicKey
  );

  await context.program.methods
    .removeKycProvider()
    .accounts({
      kycProvider: providerPDA,
      authority: context.keypairs.authority.publicKey,
    })
    .signers([context.keypairs.authority])
    .rpc();
}

/**
 * Gets a KYC provider's information
 */
export async function getKycProvider(
  context: TestContext,
  providerPublicKey: PublicKey
): Promise<KycProvider | null> {
  const providerPDA = await findKycProviderPDA(
    context.program.programId,
    providerPublicKey
  );

  try {
    return await (context.program.account as any).kycProvider.fetch(providerPDA) as KycProvider;
  } catch (error) {
    // Provider doesn't exist
    return null;
  }
}

/**
 * Lists all KYC providers
 */
export async function listKycProviders(
  context: TestContext
): Promise<KycProvider[]> {
  const providers = await (context.program.account as any).kycProvider.all();
  return providers.map(provider => provider.account as KycProvider);
}

/**
 * Registers a new KYC user
 */
export async function registerKycUser(
  context: TestContext,
  params: {
    userKeypair: Keypair;
    blz: string;
    ibanHash: string;
    verificationLevel: KycVerificationLevel;
    countryCode: number;
    verificationProvider: string;
    authorityKeypair?: Keypair; // Optional: provide a specific keypair, otherwise uses the context authority
  }
): Promise<PublicKey> {
  const userPDA = await findKycUserPDA(
    context.program.programId,
    params.userKeypair.publicKey
  );
  
  const authorityKeypair = params.authorityKeypair || context.keypairs.authority;

  await context.program.methods
    .registerKycUser(
      params.blz,
      params.ibanHash,
      params.verificationLevel,
      params.countryCode,
      params.verificationProvider
    )
    .accounts({
      kycUser: userPDA,
      user: params.userKeypair.publicKey,
      authority: authorityKeypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([authorityKeypair, params.userKeypair])
    .rpc();

  return userPDA;
}

/**
 * Updates a KYC user's verification status
 */
export async function updateKycStatus(
  context: TestContext,
  params: {
    userPublicKey: PublicKey;
    status: 'verified' | 'pending' | 'rejected';
    verificationLevel?: KycVerificationLevel;
    expiryDate?: number;
    authorityKeypair?: Keypair; // Optional: provide a specific keypair, otherwise uses the context authority
  }
): Promise<void> {
  const userPDA = await findKycUserPDA(
    context.program.programId,
    params.userPublicKey
  );
  
  const authorityKeypair = params.authorityKeypair || context.keypairs.authority;
  
  let statusObject;
  if (params.status === 'verified') {
    statusObject = { verified: {} };
  } else if (params.status === 'pending') {
    statusObject = { pending: {} };
  } else {
    statusObject = { rejected: {} };
  }

  await context.program.methods
    .updateKycStatus(
      statusObject,
      params.verificationLevel || 0,
      params.expiryDate || 0
    )
    .accounts({
      kycUser: userPDA,
      authority: authorityKeypair.publicKey,
    })
    .signers([authorityKeypair])
    .rpc();
}

/**
 * Gets a KYC user's information
 */
export async function getKycUser(
  context: TestContext,
  userPublicKey: PublicKey
): Promise<KycUser | null> {
  const userPDA = await findKycUserPDA(
    context.program.programId,
    userPublicKey
  );

  try {
    return await (context.program.account as any).kycUser.fetch(userPDA) as KycUser;
  } catch (error) {
    // User doesn't exist
    return null;
  }
}

/**
 * Validates whether a user has sufficient KYC level for an operation
 */
export async function validateKycLevel(
  context: TestContext,
  params: {
    userPublicKey: PublicKey;
    requiredLevel: KycVerificationLevel;
  }
): Promise<boolean> {
  const user = await getKycUser(context, params.userPublicKey);
  if (!user) {
    return false;
  }
  
  // Check if verification is valid (not expired and verified status)
  const now = Math.floor(Date.now() / 1000);
  const isExpired = user.expiryDate > 0 && user.expiryDate < now;
  const isVerified = 'verified' in user.status;
  
  if (isExpired || !isVerified) {
    return false;
  }
  
  // Check if verification level is sufficient
  return user.verificationLevel >= params.requiredLevel;
}

/**
 * Performs a third-party verification of KYC data
 */
export async function verifyWithThirdParty(
  context: TestContext,
  params: {
    userPublicKey: PublicKey;
    providerPublicKey: PublicKey;
    isValid: boolean;
    verificationData: string;
    authorityKeypair?: Keypair; // Optional: provide a specific keypair, otherwise uses the provider keypair
  }
): Promise<void> {
  const userPDA = await findKycUserPDA(
    context.program.programId,
    params.userPublicKey
  );
  
  const providerPDA = await findKycProviderPDA(
    context.program.programId,
    params.providerPublicKey
  );
  
  const providerKeypair = params.authorityKeypair || 
    await context.provider.wallet.payer; // This assumes the wallet is the provider
  
  await context.program.methods
    .verifyWithThirdParty(
      params.isValid,
      params.verificationData
    )
    .accounts({
      kycUser: userPDA,
      kycProvider: providerPDA,
      authority: providerKeypair.publicKey,
    })
    .signers([providerKeypair])
    .rpc();
  
  // If valid, update the status to verified
  if (params.isValid) {
    await updateKycStatus(context, {
      userPublicKey: params.userPublicKey,
      status: 'verified',
      authorityKeypair: context.keypairs.authority
    });
  }
}

/**
 * Lists all KYC users
 */
export async function listKycUsers(
  context: TestContext
): Promise<KycUser[]> {
  const users = await (context.program.account as any).kycUser.all();
  return users.map(user => user.account as KycUser);
}

/**
 * Gets KYC statistics
 */
export async function getKycStats(
  context: TestContext
): Promise<{
  totalUsers: number;
  verifiedUsers: number;
  pendingUsers: number;
  rejectedUsers: number;
  expiredUsers: number;
  level1Users: number;
  level2Users: number;
}> {
  const users = await listKycUsers(context);
  const now = Math.floor(Date.now() / 1000);
  
  return {
    totalUsers: users.length,
    verifiedUsers: users.filter(u => 'verified' in u.status).length,
    pendingUsers: users.filter(u => 'pending' in u.status).length,
    rejectedUsers: users.filter(u => 'rejected' in u.status).length,
    expiredUsers: users.filter(u => u.expiryDate > 0 && u.expiryDate < now).length,
    level1Users: users.filter(u => 'verified' in u.status && u.verificationLevel === 1).length,
    level2Users: users.filter(u => 'verified' in u.status && u.verificationLevel === 2).length,
  };
}

/**
 * Signs verification data using a provider's keypair
 */
export function signVerificationData(
  providerKeypair: Keypair, 
  verificationData: string | object
): Uint8Array {
  // Convert object to string if needed
  const dataString = typeof verificationData === 'object' 
    ? JSON.stringify(verificationData) 
    : verificationData;
    
  // Create buffer from the data - we don't use this directly but useful for real implementation
  // No need to store in a variable if unused
  Buffer.from(dataString);
  
  // Sign the data
  return providerKeypair.secretKey.slice(0, 64);  // This is a stub - in a real implementation, this would sign the data
}

/**
 * Processes a third-party verification
 */
export async function processThirdPartyVerification(
  context: TestContext,
  params: {
    userKeypair: Keypair;
    providerId: string;  // This would be a PublicKey in real implementation
    verificationId: string;
    verificationData: string;
    verificationLevel: number;
    expiryDays: number;
    signature: Uint8Array;
  }
): Promise<PublicKey> {
  // This is a simplified implementation for testing
  
  // 1. Find the provider by id (in real implementation, you'd look up by public key)
  const providers = await listKycProviders(context);
  const provider = providers.find(p => p.id === params.providerId);
  
  if (!provider) {
    throw new Error(`Provider ${params.providerId} not found`);
  }
  
  if (!provider.isActive) {
    throw new Error(`Provider ${params.providerId} is not active`);
  }
  
  // 2. Generate the user KYC PDA
  const userPDA = await findKycUserPDA(
    context.program.programId,
    params.userKeypair.publicKey
  );
  
  // 3. Register the user with the verification level
  await registerKycUser(context, {
    userKeypair: params.userKeypair,
    blz: "verifiedByThirdParty",
    ibanHash: `verified-${params.verificationId}`,
    verificationLevel: params.verificationLevel,
    countryCode: 0, // This would be parsed from the verification data in a real implementation
    verificationProvider: params.providerId
  });
  
  // 4. Update the user's status to verified
  await updateKycStatus(context, {
    userPublicKey: params.userKeypair.publicKey,
    status: 'verified',
    verificationLevel: params.verificationLevel,
    expiryDate: Math.floor(Date.now() / 1000) + (params.expiryDays * 24 * 60 * 60)
  });
  
  return userPDA;
} 