# MiCA EUR

<p align="center">
  <img src="assets/micaEur_banner.png" alt="MiCA EUR banner" width="700" />
</p>

A regulatory-compliant EUR stablecoin implementation on Solana following the Markets in Crypto-Assets (MiCA) regulation framework.

## Overview

This project implements a fully MiCA-compliant Euro stablecoin with KYC verification, AML controls, and regulatory compliance mechanisms using Solana's SPL Token-2022 standard.

### Key Features

- **KYC Oracle** - On-chain identity verification system
- **AML Controls** - Blacklisting and suspicious activity monitoring
- **Regulatory Compliance** - Freeze/seizure capabilities for regulatory compliance
- **Reserve Verification** - On-chain proof of reserve validation

### System Architecture

```mermaid
flowchart TB
    User[User Wallet] <--> KYC[KYC Oracle]
    User <--> Token[Token Operations]
    Token <--> AML[AML Controls]
    KYC --- Compliance[Compliance Engine]
    AML --- Compliance
    Token --- Mint[Mint Authority]
    Token --- Freeze[Freeze Authority]
    Mint --- Reserve[Reserve Verification]
    Compliance --- Reserve
    Compliance --- Regulatory[Regulatory Authority]
    Regulatory --- Freeze
```

### Detailed System Diagram

```mermaid
graph TD
    %% User Facing Layer
    subgraph "User Facing Layer"
        UI["Frontend UI"]:::frontend
    end

    %% Off-chain Services
    subgraph "Off-chain Services"
        Compliance["Compliance API"]:::backend
        KYC["KYC API"]:::backend
        Webhook["Webhook Verification"]:::backend
        SolIntegration["Solana Integration Helper"]:::backend
    end

    %% On-chain RPC
    SolRPC[(Solana RPC)]:::onchain

    %% On-chain Program
    subgraph "On-chain Program (MiCA_EUR)" 
        Config["Anchor Configuration"]:::onchain
        Program["MiCA_EUR Program"]:::onchain
        KYCOracle["KYC Oracle Module"]:::onchain
        AML["AML Controls Module"]:::onchain
        MintUtils["Mint & Freeze/Seize Utilities"]:::onchain
        Reserve["Reserve Verification Module"]:::onchain
        ErrorDefs["Error Definitions"]:::onchain
        Constants["Program Constants"]:::onchain
    end

    %% External & DevOps
    subgraph "External Services & DevOps"
        OnfidoAPI["Onfido API"]:::external
        RegAuth["Regulatory Authority"]:::external
        Scripts["Deployment & Automation Scripts"]:::external
        Migration["Migration Script"]:::external
        Tests["End-to-End & Integration Tests"]:::external
    end

    %% Connections
    UI -->|"POST /api/... "| Compliance
    UI -->|"POST /api/kyc/initiate"| KYC

    Compliance -->|"Verifies & routes"| KYC
    Compliance -->|"RPC call: mint_to / freeze"| SolRPC
    KYC -->|"Handles webhooks & data"| Webhook
    KYC -->|"Uses helper"| SolIntegration
    KYC -->|"RPC call: kyc_oracle_update"| SolRPC

    KYC -.->|"Send KYC data"| OnfidoAPI
    OnfidoAPI -.->|"Webhook"| Webhook
    Compliance -->|"Aggregates KYC/AML"| SolRPC

    SolRPC -->|"invoke"| Program
    Program --> KYCOracle
    Program --> AML
    Program --> MintUtils
    Program --> Reserve
    Program --> ErrorDefs
    Program --> Constants

    RegAuth -.->|"Freeze/Seize request"| MintUtils

    Scripts --> Migration
    Scripts --> Tests

    %% Click Events
    click UI "https://github.com/bsc-aujl/micaeur/tree/main/sources/app/frontend"
    click Compliance "https://github.com/bsc-aujl/micaeur/blob/main/sources/app/compliance-api/index.js"
    click KYC "https://github.com/bsc-aujl/micaeur/blob/main/sources/kyc-api/index.ts"
    click Webhook "https://github.com/bsc-aujl/micaeur/blob/main/sources/kyc-api/webhook-verification.ts"
    click SolIntegration "https://github.com/bsc-aujl/micaeur/blob/main/sources/kyc-api/solana-integration.ts"
    click Config "https://github.com/bsc-aujl/micaeur/blob/main/Anchor.toml"
    click Program "https://github.com/bsc-aujl/micaeur/blob/main/sources/sol-programs/mica_eur/src/lib.rs"
    click KYCOracle "https://github.com/bsc-aujl/micaeur/blob/main/sources/sol-programs/mica_eur/src/kyc_oracle.rs"
    click AML "https://github.com/bsc-aujl/micaeur/blob/main/sources/sol-programs/mica_eur/src/aml.rs"
    click MintUtils "https://github.com/bsc-aujl/micaeur/blob/main/sources/sol-programs/mica_eur/src/mint_utils.rs"
    click Reserve "https://github.com/bsc-aujl/micaeur/blob/main/sources/sol-programs/mica_eur/src/merkle_info.rs"
    click ErrorDefs "https://github.com/bsc-aujl/micaeur/blob/main/sources/sol-programs/mica_eur/src/error.rs"
    click Constants "https://github.com/bsc-aujl/micaeur/blob/main/sources/sol-programs/mica_eur/src/constants.rs"
    click Scripts "https://github.com/bsc-aujl/micaeur/tree/main/scripts/"
    click Migration "https://github.com/bsc-aujl/micaeur/blob/main/sources/migrations/deploy.ts"
    click Tests "https://github.com/bsc-aujl/micaeur/tree/main/sources/sol-programs/mica_eur/tests"

    %% Styles
    classDef frontend fill:#ADD8E6,stroke:#000,stroke-width:1px
    classDef backend fill:#90EE90,stroke:#000,stroke-width:1px
    classDef onchain fill:#FFA500,stroke:#000,stroke-width:1px
    classDef external fill:#D3D3D3,stroke:#000,stroke-width:1px
```

## Prerequisites

- Rust nightly-2025-05-11 (specifically `rustc 1.89.0-nightly`)
- Solana CLI v1.18.17
- Anchor CLI v0.30.1
- Node.js v16+

## Project Structure

```
mica_eur/
├── sources/                  # Main code container
│   ├── sol-programs/         # Solana programs (Anchor-based)
│   │   └── mica_eur/         # MiCA EUR stablecoin implementation
│   │       ├── src/          # Program source code
│   │       └── tests/        # Program-specific tests
│   ├── interface/            # TypeScript utilities/APIs
│   │   ├── clients/          # Program clients
│   │   ├── types/            # Type definitions
│   │   └── tests/            # Interface tests
│   ├── app/                  # Application components
│   │   ├── compliance-api/   # Compliance API implementation
│   │   └── frontend/         # Frontend application (to be implemented)
│   ├── kyc-api/              # KYC API implementation
│   │   └── tests/            # KYC API tests
│   └── migrations/           # Deployment migration scripts
├── docs/                     # Documentation
└── scripts/                  # Utility scripts
```

## Quick Start

```bash
# Clone and set up
git clone https://github.com/your-org/mica_eur.git
cd mica_eur
./scripts/setup.sh

# Build
anchor build

# Run tests
npm run test:functional
```

## Development

### Build

```bash
# Standard build
anchor build

# Fast build (skips linting)
npm run build:fast
```

### Testing

```bash
# Run all functional tests
npm run test:functional

# Specific test suites
npm run test:kyc           # KYC Oracle tests
npm run test:token         # Token functionality tests
npm run test:aml           # AML Authority tests
npm run test:freeze-seize  # Freeze/Seize functionality tests
```

### Deployment

```bash
anchor deploy --provider.cluster devnet
```

## Component Documentation

Each component directory contains its own README.md with specific documentation:

- [Solana Programs](./sources/sol-programs/README.md)
- KYC API (see original documentation in component directory)
- Application Components (see original documentation in component directories)
