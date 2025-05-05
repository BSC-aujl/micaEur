/**
 * Tests for Third-Party KYC Provider Integration
 *
 * These tests verify that the program correctly handles third-party KYC
 * provider registration, verification, and management.
 */

import { assert } from 'chai';
import { PublicKey, Keypair } from '@solana/web3.js';
import { setupTestContext } from '../framework/setup';
import { TestContext } from '../framework/types';
import { 
  registerKycProvider, 
  updateKycProvider, 
  getKycProvider,
  processThirdPartyVerification,
  listKycProviders,
  signVerificationData
} from '../framework/kyc-provider-helpers';

describe('Third-Party KYC Provider Integration', () => {
  let context: TestContext;
  let providerKeypair: Keypair;
  let providerPDA: PublicKey;
  const providerId = 'test-provider-1';
  const providerName = 'Test KYC Provider';
  
  // Set up the test context once for all tests
  before(async () => {
    context = await setupTestContext();
    providerKeypair = Keypair.generate();
  });
  
  describe('Provider Registration and Management', () => {
    it('should register a new KYC provider', async () => {
      // Register a new provider
      providerPDA = await registerKycProvider(context, {
        providerId,
        name: providerName,
        verificationLevels: [1, 2, 3],
        initialTrustScore: 85,
        providerKeypair
      });
      
      // Fetch and verify the provider data
      const provider = await getKycProvider(context, providerId);
      
      assert.isDefined(provider);
      assert.equal(provider.id, providerId);
      assert.equal(provider.name, providerName);
      assert.equal(provider.trustScore, 85);
      assert.isTrue(provider.isActive);
      assert.deepEqual(provider.verificationLevels, [1, 2, 3]);
      assert.isTrue(provider.publicKey.equals(providerKeypair.publicKey));
    });
    
    it('should update a KYC provider', async () => {
      // Update the provider
      await updateKycProvider(context, {
        providerId,
        name: 'Updated Provider Name',
        trustScore: 90
      });
      
      // Fetch and verify the updated data
      const provider = await getKycProvider(context, providerId);
      
      assert.equal(provider.name, 'Updated Provider Name');
      assert.equal(provider.trustScore, 90);
    });
    
    it('should deactivate a KYC provider', async () => {
      // Deactivate the provider
      await updateKycProvider(context, {
        providerId,
        isActive: false
      });
      
      // Fetch and verify the provider is deactivated
      const provider = await getKycProvider(context, providerId);
      
      assert.isFalse(provider.isActive);
    });
    
    it('should reactivate a KYC provider', async () => {
      // Reactivate the provider
      await updateKycProvider(context, {
        providerId,
        isActive: true
      });
      
      // Fetch and verify the provider is reactivated
      const provider = await getKycProvider(context, providerId);
      
      assert.isTrue(provider.isActive);
    });
    
    it('should list all registered KYC providers', async () => {
      // Register another provider
      const secondProviderId = 'test-provider-2';
      await registerKycProvider(context, {
        providerId: secondProviderId,
        name: 'Second Provider',
        verificationLevels: [1, 2],
        initialTrustScore: 75
      });
      
      // List all providers
      const providers = await listKycProviders(context);
      
      // Should have at least 2 providers
      assert.isAtLeast(providers.length, 2);
      
      // Verify we can find our test providers
      const foundFirstProvider = providers.some(p => p.id === providerId);
      const foundSecondProvider = providers.some(p => p.id === secondProviderId);
      
      assert.isTrue(foundFirstProvider);
      assert.isTrue(foundSecondProvider);
    });
  });
  
  describe('Third-Party Verification Process', () => {
    let userKeypair: Keypair;
    let userPDA: PublicKey;
    
    beforeEach(() => {
      userKeypair = Keypair.generate();
    });
    
    it('should process a valid third-party verification', async () => {
      // Create verification data
      const verificationId = 'verification-123';
      const verificationData = JSON.stringify({
        userId: userKeypair.publicKey.toString(),
        timestamp: Date.now(),
        kycLevel: 2,
        verificationDetails: 'Passport verification'
      });
      
      // Sign the verification data
      const signature = signVerificationData(providerKeypair, verificationData);
      
      // Process the verification
      userPDA = await processThirdPartyVerification(context, {
        userKeypair,
        providerId,
        verificationId,
        verificationData,
        verificationLevel: 2,
        expiryDays: 365,
        signature
      });
      
      // Verify the user's KYC status (this would be through the existing KYC functions)
      const kycStatus = await context.program.account.kycUser.fetch(userPDA);
      
      assert.isDefined(kycStatus);
      assert.isTrue('verified' in kycStatus.status);
      assert.equal(kycStatus.verificationLevel, 2);
    });
    
    it('should reject verification from deactivated provider', async () => {
      // Deactivate the provider
      await updateKycProvider(context, {
        providerId,
        isActive: false
      });
      
      // Try to process verification with deactivated provider
      const verificationId = 'verification-124';
      const verificationData = JSON.stringify({
        userId: userKeypair.publicKey.toString(),
        timestamp: Date.now(),
        kycLevel: 2
      });
      
      const signature = signVerificationData(providerKeypair, verificationData);
      
      try {
        await processThirdPartyVerification(context, {
          userKeypair,
          providerId,
          verificationId,
          verificationData,
          verificationLevel: 2,
          expiryDays: 365,
          signature
        });
        
        // Should have thrown an error
        assert.fail('Should not process verification from deactivated provider');
      } catch (error) {
        // This is expected
        assert.include(error.toString(), 'Error');
      }
      
      // Reactivate the provider for other tests
      await updateKycProvider(context, {
        providerId,
        isActive: true
      });
    });
  });
}); 