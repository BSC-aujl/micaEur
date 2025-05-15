# KYC API

API integration for Know Your Customer (KYC) verification with the MiCA EUR stablecoin.

## Overview

This API provides KYC verification services and integrates with the Solana blockchain to update KYC statuses for the MiCA EUR stablecoin.

## Components

- **index.ts** - Main API entry point and endpoints
- **solana-integration.ts** - Integration with Solana blockchain and KYC Oracle
- **webhook-verification.ts** - Verification of KYC provider webhooks

## KYC Flow Overview

The MiCA EUR stablecoin implements a comprehensive KYC flow:

1. **KYC Oracle Initialization**: Setting up the centralized authority
2. **User Registration**: Registering users in the KYC system
3. **KYC Verification**: Updating user status and verification level
4. **Account Creation**: Creating token accounts (initially frozen)
5. **Account Thawing**: Thawing accounts for KYC-verified users
6. **Token Operations**: Minting, transferring, and burning tokens based on KYC status

### KYC Flow Diagram

The following diagram illustrates the KYC verification flow:

```mermaid
flowchart LR
    U[User Wallet] -->|POST /api/kyc/initiate| AG[API Gateway]
    AG -->|createApplicant| OA[Onfido API]
    AG -->|startWorkflow| OW[Onfido SDK]
    U -->|POST /api/kyc/verify-signature| SV[Signature Verifier]
    OA -->|webhook (check completed)| AG
    AG -->|updateKycStatus| SI[Solana Integration]
    SI -->|rpc| KO[KYC Oracle State PDA]
    SI -->|rpc| KU[KYC User PDA]
```

### Verification Levels

- **Unverified (Level 0)**: Can transfer tokens, but cannot mint or redeem
- **Basic (Level 1)**: Individual users with verified bank accounts, can mint and redeem
- **Standard (Level 2)**: Business users with additional compliance checks, higher limits
- **Advanced (Level 3)**: Institutional users with comprehensive checks, highest limits

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   ```

3. Configure API keys in the `.env` file:
   ```
   KYC_API_KEY=your_kyc_provider_api_key
   KYC_API_SECRET=your_kyc_provider_api_secret
   ```

## Usage

### Start the API Service

```bash
npm start
```

### Development Mode

```bash
npm run dev
```

### Testing

```bash
npm test
```

## API Endpoints

- **POST /api/kyc/initiate** - Initiate KYC verification
- **POST /api/kyc/callback** - KYC provider webhook callback
- **POST /api/kyc/update** - Manual KYC status update
- **GET /api/kyc/status/:userId** - Get KYC status 