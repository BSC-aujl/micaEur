# MiCA EUR Frontend

User interface for the MiCA EUR stablecoin.

## Overview

The frontend application provides a user interface for interacting with the MiCA EUR stablecoin, including:

- User account management
- KYC verification
- Token transfer and management
- Transaction history and reporting

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env.local
   ```

3. Update configuration in `.env.local`:
   ```
   NEXT_PUBLIC_RPC_URL=your_solana_rpc_url
   NEXT_PUBLIC_KYC_API_URL=your_kyc_api_url
   ```

## Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test
```

## Features

### Wallet Management

- Connect with Solana wallets (Phantom, Solflare, etc.)
- View account balances and transaction history
- Initiate transfers and redemptions

### KYC Verification

- Complete KYC verification process
- Check verification status
- Manage verification levels

### Token Management

- View token balances
- Transfer tokens
- Request token redemption

### Analytics

- View transaction history
- Export transaction reports
- Monitor verification status 