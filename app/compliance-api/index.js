const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const { Program } = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

// Initialize Express app
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Load environment variables (in production, use dotenv or similar)
const PORT = process.env.PORT || 3001;
const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';
const PROGRAM_ID = process.env.PROGRAM_ID || 'FqyFQg8TEaxKNGd5LqHRMBKfNVQHeiohorXRiu2dATZX';

// Mock database for KYC status (in production, use a real database)
const kycDatabase = new Map();
const reserveBalances = new Map();

// Connect to Solana
const connection = new Connection(RPC_URL);
// In production, load from secure storage
const adminKeypair = Keypair.generate(); 

// Mock BLZ database for German banks
const germanBanks = {
  '10000000': { name: 'Bundesbank', city: 'Berlin' },
  '10010010': { name: 'Postbank', city: 'Bonn' },
  '10019610': { name: 'Deutsche Bank', city: 'Frankfurt' },
  '10050000': { name: 'Landesbank Berlin', city: 'Berlin' },
  '10070000': { name: 'Deutsche Bank', city: 'Berlin' },
  '20050000': { name: 'HSH Nordbank', city: 'Hamburg' },
  '30050000': { name: 'WestLB', city: 'Düsseldorf' },
  '37040044': { name: 'Commerzbank', city: 'Cologne' }
};

// Mock PSD2 banking API for demo purposes
class MockBankingAPI {
  // Check if a bank exists
  static validateBLZ(blz) {
    return germanBanks.hasOwnProperty(blz);
  }
  
  // Validate IBAN format (basic check - not full validation)
  static validateIBAN(iban) {
    // Simple check for German IBAN format: DE + 2 check digits + 8 digit BLZ + 10 digit account number
    const germanIBANRegex = /^DE\d{2}[0-9]{8}[0-9]{10}$/;
    return germanIBANRegex.test(iban);
  }
  
  // Get bank details from BLZ
  static getBankDetails(blz) {
    return germanBanks[blz] || null;
  }
  
  // Mock checking if a SEPA transfer has been completed
  static async checkSEPATransfer(reference, amount) {
    // Simulate async processing with 50% chance of success
    return new Promise((resolve) => {
      setTimeout(() => {
        const success = Math.random() > 0.5;
        resolve({
          success,
          reference,
          amount,
          timestamp: Date.now(),
          status: success ? 'completed' : 'pending'
        });
      }, 1000);
    });
  }
  
  // Mock PSD2 account balance check
  static async getAccountBalance(iban, authToken) {
    // Simulate real balance with random fluctuation
    return {
      iban,
      balance: 10000000 + Math.floor(Math.random() * 1000000),
      currency: 'EUR',
      timestamp: Date.now()
    };
  }
}

// Veriff KYC mock API
class MockVeriffAPI {
  static async verifyIdentity(userData) {
    // Simulate KYC verification
    return new Promise((resolve) => {
      setTimeout(() => {
        const verificationId = crypto.randomUUID();
        const success = Math.random() > 0.3;
        
        resolve({
          success,
          verificationId,
          status: success ? 'approved' : 'pending',
          details: success ? {
            firstName: userData.firstName,
            lastName: userData.lastName,
            country: userData.country,
            documentType: 'passport',
            documentNumber: `DE${Math.floor(Math.random() * 10000000)}`,
            verificationLevel: 2,
            expiryDate: new Date(Date.now() + 365*24*60*60*1000).toISOString()
          } : null
        });
      }, 2000);
    });
  }
}

// API Routes
// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: Date.now() });
});

// Initiate KYC verification
app.post('/kyc/verify', async (req, res) => {
  try {
    const { firstName, lastName, dateOfBirth, address, country, blz, iban, walletAddress } = req.body;
    
    // Validate required parameters
    if (!firstName || !lastName || !blz || !iban || !walletAddress) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters' 
      });
    }
    
    // Validate BLZ
    if (!MockBankingAPI.validateBLZ(blz)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid BLZ (German Bank Code)' 
      });
    }
    
    // Validate IBAN
    if (!MockBankingAPI.validateIBAN(iban)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid IBAN format' 
      });
    }
    
    // Validate Solana address
    let pubkey;
    try {
      pubkey = new PublicKey(walletAddress);
    } catch (e) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid Solana wallet address' 
      });
    }
    
    // Generate KYC verification ID
    const kycId = crypto.randomUUID();
    
    // Call mock Veriff API
    const veriffResult = await MockVeriffAPI.verifyIdentity({
      firstName,
      lastName,
      dateOfBirth,
      address,
      country,
      blz,
      iban
    });
    
    // Hash the IBAN for privacy
    const ibanHash = crypto.createHash('sha256').update(iban).digest('hex');
    
    // Store KYC request in mock database
    kycDatabase.set(kycId, {
      personalInfo: {
        firstName,
        lastName,
        dateOfBirth,
        address,
        country
      },
      bankInfo: {
        blz,
        ibanHash,
        bankDetails: MockBankingAPI.getBankDetails(blz)
      },
      walletAddress: pubkey.toString(),
      status: veriffResult.success ? 'approved' : 'pending',
      verificationId: veriffResult.verificationId,
      timestamp: Date.now(),
      expiryDate: veriffResult.success 
        ? new Date(Date.now() + 365*24*60*60*1000).getTime()
        : null
    });
    
    // Return the result
    res.status(200).json({
      success: true,
      kycId,
      status: veriffResult.success ? 'approved' : 'pending',
      message: veriffResult.success 
        ? 'KYC verification approved'
        : 'KYC verification initiated, pending approval'
    });
    
  } catch (error) {
    console.error('KYC verification error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error during KYC verification' 
    });
  }
});

// Check KYC status
app.get('/kyc/status/:kycId', (req, res) => {
  const { kycId } = req.params;
  
  if (!kycDatabase.has(kycId)) {
    return res.status(404).json({
      success: false,
      error: 'KYC verification not found'
    });
  }
  
  const kycData = kycDatabase.get(kycId);
  
  res.status(200).json({
    success: true,
    kycId,
    status: kycData.status,
    walletAddress: kycData.walletAddress,
    timestamp: kycData.timestamp,
    expiryDate: kycData.expiryDate,
    bankInfo: {
      blz: kycData.bankInfo.blz,
      bankName: kycData.bankInfo.bankDetails?.name || 'Unknown Bank'
    }
  });
});

// Update KYC status (admin endpoint, should be secured in production)
app.put('/kyc/admin/update/:kycId', (req, res) => {
  const { kycId } = req.params;
  const { status } = req.body;
  
  if (!kycDatabase.has(kycId)) {
    return res.status(404).json({
      success: false,
      error: 'KYC verification not found'
    });
  }
  
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid status. Must be "pending", "approved", or "rejected"'
    });
  }
  
  const kycData = kycDatabase.get(kycId);
  kycData.status = status;
  
  if (status === 'approved') {
    kycData.expiryDate = new Date(Date.now() + 365*24*60*60*1000).getTime();
  }
  
  kycDatabase.set(kycId, kycData);
  
  res.status(200).json({
    success: true,
    kycId,
    status,
    message: `KYC status updated to "${status}"`
  });
});

// Reserve balance endpoints for proof-of-reserve
app.post('/reserve/update', (req, res) => {
  const { bankAccounts, timestamp } = req.body;
  
  if (!Array.isArray(bankAccounts)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid bank accounts data'
    });
  }
  
  let totalReserve = 0;
  
  // Calculate total reserve
  bankAccounts.forEach(account => {
    if (account.balance && account.currency === 'EUR') {
      totalReserve += account.balance;
    }
  });
  
  // Store reserve data with timestamp
  const reserveId = crypto.randomUUID();
  reserveBalances.set(reserveId, {
    totalReserve,
    accounts: bankAccounts,
    timestamp: timestamp || Date.now(),
    merkleRoot: crypto.randomBytes(32).toString('hex')
  });
  
  res.status(200).json({
    success: true,
    reserveId,
    totalReserve,
    timestamp: reserveBalances.get(reserveId).timestamp,
    merkleRoot: reserveBalances.get(reserveId).merkleRoot
  });
});

// Get latest reserve data
app.get('/reserve/latest', (req, res) => {
  if (reserveBalances.size === 0) {
    return res.status(404).json({
      success: false,
      error: 'No reserve data available'
    });
  }
  
  // Find the most recent reserve entry
  let latestReserve = null;
  let latestTimestamp = 0;
  
  for (const [id, data] of reserveBalances.entries()) {
    if (data.timestamp > latestTimestamp) {
      latestTimestamp = data.timestamp;
      latestReserve = {
        reserveId: id,
        ...data
      };
    }
  }
  
  res.status(200).json({
    success: true,
    ...latestReserve
  });
});

// SEPA payment processing (for minting)
app.post('/payment/sepa-transfer', async (req, res) => {
  const { iban, blz, amount, reference, kycId } = req.body;
  
  if (!iban || !blz || !amount || !reference) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters'
    });
  }
  
  // Validate BLZ and IBAN
  if (!MockBankingAPI.validateBLZ(blz) || !MockBankingAPI.validateIBAN(iban)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid BLZ or IBAN'
    });
  }
  
  // Verify KYC if provided
  if (kycId && kycDatabase.has(kycId)) {
    const kycData = kycDatabase.get(kycId);
    if (kycData.status !== 'approved') {
      return res.status(403).json({
        success: false,
        error: 'KYC verification not approved'
      });
    }
  } else if (kycId) {
    return res.status(404).json({
      success: false,
      error: 'KYC verification not found'
    });
  }
  
  // Check SEPA transfer status
  const transferResult = await MockBankingAPI.checkSEPATransfer(reference, amount);
  
  res.status(200).json({
    success: transferResult.success,
    paymentId: crypto.randomUUID(),
    reference,
    amount,
    currency: 'EUR',
    status: transferResult.status,
    timestamp: transferResult.timestamp,
    message: transferResult.success 
      ? 'SEPA transfer completed successfully'
      : 'SEPA transfer pending or failed'
  });
});

// PSD2 Account information (mock for demo)
app.get('/banking/account-info', async (req, res) => {
  const { iban, authToken } = req.query;
  
  if (!iban) {
    return res.status(400).json({
      success: false,
      error: 'IBAN is required'
    });
  }
  
  if (!MockBankingAPI.validateIBAN(iban)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid IBAN format'
    });
  }
  
  // Get account balance
  const accountInfo = await MockBankingAPI.getAccountBalance(iban);
  
  res.status(200).json({
    success: true,
    account: {
      iban,
      balance: accountInfo.balance,
      currency: accountInfo.currency,
      availableBalance: accountInfo.balance,
      lastUpdated: new Date(accountInfo.timestamp).toISOString()
    }
  });
});

// BaFin compliance endpoint
app.post('/bafin/freeze/:walletAddress', (req, res) => {
  const { walletAddress } = req.params;
  const { reason, caseNumber, orderDate } = req.body;
  
  if (!reason || !caseNumber) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters'
    });
  }
  
  // In a real implementation, this would call the on-chain freeze functionality
  
  res.status(200).json({
    success: true,
    walletAddress,
    status: 'frozen',
    reason,
    caseNumber,
    orderDate: orderDate || new Date().toISOString(),
    timestamp: Date.now()
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`MiCA EUR Compliance API running on port ${PORT}`);
}); 