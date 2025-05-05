/**
 * Helper functions for AML authority management
 * 
 * These functions assist with registering and managing AML authorities,
 * and handling AML alerts and actions.
 */

// Signature: ZHVtbXlfc2lnbmF0dXJlX2Zvcl9hbWxfYXV0aG9yaXR5X2hlbHBlcnM=

/* eslint-disable @typescript-eslint/no-explicit-any */
import { PublicKey, Keypair, SystemProgram } from '@solana/web3.js';
import { 
  TestContext, 
  AmlAuthority, 
  AmlPower, 
  AmlAlert,
  AmlAlertType,
  AmlAlertStatus 
} from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Derives the PDA for an AML authority
 */
export async function findAmlAuthorityPDA(
  programId: PublicKey, 
  authorityPublicKey: PublicKey
): Promise<PublicKey> {
  const [pda] = await PublicKey.findProgramAddress(
    [
      Buffer.from('aml-authority'),
      authorityPublicKey.toBuffer(),
    ],
    programId
  );
  return pda;
}

/**
 * Derives the PDA for an AML alert
 */
export async function findAmlAlertPDA(
  programId: PublicKey, 
  alertId: string
): Promise<PublicKey> {
  const [pda] = await PublicKey.findProgramAddress(
    [
      Buffer.from('aml-alert'),
      Buffer.from(alertId),
    ],
    programId
  );
  return pda;
}

/**
 * Registers a new AML authority
 */
export async function registerAmlAuthority(
  context: TestContext,
  params: {
    institution: string;
    jurisdiction: string;
    powers: AmlPower[];
    authorityKeypair?: Keypair; // Optional: provide a specific keypair, otherwise one will be generated
  }
): Promise<PublicKey> {
  const authorityKeypair = params.authorityKeypair || Keypair.generate();
  const authorityPDA = await findAmlAuthorityPDA(
    context.program.programId,
    authorityKeypair.publicKey
  );

  await context.program.methods
    .registerAmlAuthority(
      params.institution,
      params.jurisdiction,
      params.powers
    )
    .accounts({
      amlAuthority: authorityPDA,
      authorityKey: authorityKeypair.publicKey,
      authority: context.keypairs.authority.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([context.keypairs.authority, authorityKeypair])
    .rpc();

  return authorityPDA;
}

/**
 * Updates an AML authority's information
 */
export async function updateAmlAuthority(
  context: TestContext,
  params: {
    authorityPublicKey: PublicKey;
    institution?: string;
    jurisdiction?: string;
    powers?: AmlPower[];
  }
): Promise<void> {
  const authorityPDA = await findAmlAuthorityPDA(
    context.program.programId,
    params.authorityPublicKey
  );

  await context.program.methods
    .updateAmlAuthority(
      params.institution,
      params.jurisdiction,
      params.powers
    )
    .accounts({
      amlAuthority: authorityPDA,
      authority: context.keypairs.authority.publicKey,
    })
    .signers([context.keypairs.authority])
    .rpc();
}

/**
 * Removes an AML authority
 */
export async function removeAmlAuthority(
  context: TestContext,
  authorityPublicKey: PublicKey
): Promise<void> {
  const authorityPDA = await findAmlAuthorityPDA(
    context.program.programId,
    authorityPublicKey
  );

  await context.program.methods
    .removeAmlAuthority()
    .accounts({
      amlAuthority: authorityPDA,
      authority: context.keypairs.authority.publicKey,
    })
    .signers([context.keypairs.authority])
    .rpc();
}

/**
 * Gets an AML authority's information
 */
export async function getAmlAuthority(
  context: TestContext,
  authorityPublicKey: PublicKey
): Promise<AmlAuthority | null> {
  const authorityPDA = await findAmlAuthorityPDA(
    context.program.programId,
    authorityPublicKey
  );

  try {
    return await (context.program.account as any).amlAuthority.fetch(authorityPDA) as AmlAuthority;
  } catch (error) {
    // Authority doesn't exist
    return null;
  }
}

/**
 * Lists all AML authorities
 */
export async function listAmlAuthorities(
  context: TestContext
): Promise<AmlAuthority[]> {
  const authorities = await (context.program.account as any).amlAuthority.all();
  return authorities.map(auth => auth.account as AmlAuthority);
}

/**
 * Creates a new AML alert
 */
export async function createAmlAlert(
  context: TestContext,
  params: {
    userPublicKey: PublicKey;
    alertType: AmlAlertType;
    description: string;
    evidence: string[];
    authorityKeypair: Keypair;
  }
): Promise<string> {
  // Generate a unique ID for the alert
  const alertId = uuidv4();
  
  const alertPDA = await findAmlAlertPDA(
    context.program.programId,
    alertId
  );
  
  const authorityPDA = await findAmlAuthorityPDA(
    context.program.programId,
    params.authorityKeypair.publicKey
  );

  await context.program.methods
    .createAmlAlert(
      alertId,
      params.userPublicKey,
      params.alertType,
      params.description,
      params.evidence
    )
    .accounts({
      amlAlert: alertPDA,
      amlAuthority: authorityPDA,
      authority: params.authorityKeypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([params.authorityKeypair])
    .rpc();

  return alertId;
}

/**
 * Updates an AML alert
 */
export async function updateAmlAlert(
  context: TestContext,
  params: {
    alertId: string;
    status: AmlAlertStatus;
    description?: string;
    evidence?: string[];
    resolutionNotes?: string;
    authorityKeypair: Keypair;
  }
): Promise<void> {
  const alertPDA = await findAmlAlertPDA(
    context.program.programId,
    params.alertId
  );

  await context.program.methods
    .updateAmlAlert(
      params.status,
      params.description,
      params.evidence,
      params.resolutionNotes
    )
    .accounts({
      amlAlert: alertPDA,
      authority: params.authorityKeypair.publicKey,
    })
    .signers([params.authorityKeypair])
    .rpc();
}

/**
 * Gets an AML alert
 */
export async function getAmlAlert(
  context: TestContext,
  alertId: string
): Promise<AmlAlert | null> {
  const alertPDA = await findAmlAlertPDA(
    context.program.programId,
    alertId
  );

  try {
    return await (context.program.account as any).amlAlert.fetch(alertPDA) as AmlAlert;
  } catch (error) {
    // Alert doesn't exist
    return null;
  }
}

/**
 * Lists all AML alerts
 */
export async function listAmlAlerts(
  context: TestContext
): Promise<AmlAlert[]> {
  const alerts = await (context.program.account as any).amlAlert.all();
  return alerts.map(alert => alert.account as AmlAlert);
}

/**
 * Lists all AML alerts for a specific user
 */
export async function listAmlAlertsForUser(
  context: TestContext,
  userPublicKey: PublicKey
): Promise<AmlAlert[]> {
  const allAlerts = await listAmlAlerts(context);
  return allAlerts.filter(alert => 
    alert.user.equals(userPublicKey)
  );
}

/**
 * Takes action on an AML alert (freezing accounts)
 */
export async function takeAmlAction(
  context: TestContext,
  params: {
    alertId: string;
    authorityKeypair: Keypair;
    userPublicKey: PublicKey;
    blacklistReason: number;
    evidence: string;
  }
): Promise<void> {
  const alertPDA = await findAmlAlertPDA(
    context.program.programId,
    params.alertId
  );
  
  const blacklistPDA = await PublicKey.findProgramAddress(
    [
      Buffer.from('blacklist'),
      params.userPublicKey.toBuffer(),
    ],
    context.program.programId
  );

  await context.program.methods
    .takeAmlAction(
      params.blacklistReason,
      params.evidence
    )
    .accounts({
      amlAlert: alertPDA,
      blacklistEntry: blacklistPDA[0],
      user: params.userPublicKey,
      amlAuthority: await findAmlAuthorityPDA(
        context.program.programId,
        params.authorityKeypair.publicKey
      ),
      authority: params.authorityKeypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([params.authorityKeypair])
    .rpc();
  
  // Update the alert status
  await updateAmlAlert(context, {
    alertId: params.alertId,
    status: "ACTION_TAKEN",
    resolutionNotes: `Blacklisted due to ${params.blacklistReason}`,
    authorityKeypair: params.authorityKeypair
  });
} 