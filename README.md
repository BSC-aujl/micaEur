# MiCA EUR Token

This is a Solana program implementing a MiCA-compliant Euro stablecoin using the Token-2022 program, with built-in KYC/AML compliance features.

## Features

- **Token-2022 Extensions**: Uses the latest Solana Token-2022 program with extensions for:
  - Permanent delegation (for regulatory compliance)
  - Default account state (frozen by default until KYC verified)
  - Transfer hooks (for compliance checks)
  - Metadata pointer (for token standards compliance)

- **KYC Oracle**: Built-in KYC verification system with:
  - User registration
  - Verification levels
  - Expiry dates
  - Country codes
  - Banking information (BLZ, IBAN hash)

- **Regulatory Controls**:
  - Account freezing
  - Token seizure
  - Blacklisting

- **Reserve Backing**:
  - Merkle tree-based reserve proofs
  - IPFS storage for reserve documentation

## Project Structure

```
mica_eur/
├── programs/            # Solana program source code
│   └── mica_eur/        # Main program directory
│       ├── src/         # Rust source files
│       └── Cargo.toml   # Rust dependencies
├── app/                 # Web frontend (if applicable)
├── tests/               # Test suite
│   ├── unit/            # Unit tests
│   └── utils/           # Test utilities
├── scripts/             # Build and deployment scripts
└── target/              # Build artifacts
```

## Prerequisites

- Solana CLI tools
- Anchor Framework 0.28.0+
- Node.js 18+
- Rust and Cargo

## Setup

1. Clone the repository
```bash
git clone https://github.com/yourusername/mica_eur.git
cd mica_eur
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
./scripts/setup-env.sh
```

## Building

Build the program:
```bash
./scripts/build.sh
```

This will:
1. Build the Rust program
2. Generate the IDL file
3. Create JavaScript/TypeScript bindings

## Testing

This project has several types of tests to ensure the code quality:

### Unit Tests

1. **Rust Unit Tests** - These test internal functions of the Solana programs

   ```bash
   cd programs/mica_eur
   cargo test
   ```

2. **TypeScript Unit Tests** - These test specific modules:

   ```bash
   # Run all unit tests
   npm run test:unit

   # Run only KYC Oracle tests
   npm run test:kyc

   # Run only Token-2022 mint tests
   npm run test:token
   
   # Run KYC end-to-end flow test
   npm run test:kyc-flow
   ```

3. **Integration Tests** - These test the whole program:

   ```bash
   npm run test
   ```

4. **Full Test Suite** - Run all tests in sequence:
   ```bash
   npm run test:full
   ```

### KYC End-to-End Testing

The project includes a comprehensive KYC flow test that demonstrates the complete lifecycle:

1. **Initialize KYC Oracle** - Set up the KYC verification authority
2. **Register Users** - Register users for KYC with different verification levels
3. **Update KYC Status** - Process KYC verification with various status outcomes
4. **Token Operations** - Test token operations that depend on KYC verification:
   - Create token accounts (initially frozen)
   - Thaw accounts after KYC verification
   - Mint tokens to verified users
   - Transfer tokens between verified users

Run the KYC end-to-end test:

```bash
npm run test:kyc-flow
```

For more detailed information about the KYC flow, see [KYC Flow Guide](docs/kyc-flow-guide.md).

## Development Workflow

1. Make changes to the Rust program
2. Run `./scripts/build.sh` to build
3. Run tests to verify your changes
4. Deploy to devnet for further testing

## Mock Test Environment

For quick iteration, the project supports a mock test environment that doesn't require a connection to a Solana cluster.

To run tests in mock mode:
```bash
MOCK_TEST_MODE=true npm run test:unit
```

## Deployment

Deploy to devnet:
```bash
./scripts/deploy.sh devnet
```

Deploy to mainnet:
```bash
./scripts/deploy.sh mainnet
```

## License

[Insert license information here]

## 🌟 Features

- **Token-2022 Extensions**

  - DefaultAccountState (Frozen by default)
  - TransferHook (KYC verification)
  - Permanent Delegate (for regulatory compliance)
  - Metadata Pointer (for whitepaper and terms)

- **MiCA Compliance**

  - KYC verification system with flexible levels:
    - Unverified users: Can transfer tokens but cannot mint or redeem
    - Basic verification: For individuals with verified bank accounts, can mint and redeem
    - Standard verification: For businesses with additional compliance checks
    - Advanced verification: For institutional users with comprehensive compliance checks
  - Proof-of-reserve with daily merkle root
  - Freeze/seize capability for regulatory actions
  - Admin dashboard for monitoring

- **Banking Integration**

  - PSD2 API for connecting to German bank accounts
  - SEPA Instant transfer for minting/redeeming
  - BLZ (German Bank Code) verification
  - IBAN validation

- **Security & Transparency**
  - On-chain proof of reserves
  - Compliance audit log
  - BaFin/regulatory integration points

## 📐 Architecture

```
+-------------+        PSD2 API        +---------------+
|  Corporate  |<---------------------->|  Bank Sandbox |
+-------------+  (SEPA Instant / IBAN) +---------------+
       | Mint request                         ^
       v                                      |
+----------------+       on-chain             |
|  Compliance    |<---- TransferHook ---------+
|  API (Rust)    |                             \
+----------------+                              \  Daily CSV
       | KYC OK     +------------------+         \
       +------------>  Token-2022 EUR  |--------- >  Reserve JSON
                    |  Mint Program    |<----+         IPFS + Merkle
                    +------------------+     |         root on Solana
                           ^  |              |
                           |  v              | Freeze/Seize
                     +-------------+         |
                     | Court Del.  |---------+
                     +-------------+
```

## 🔧 Technical Components

1. **Anchor Program**: Solana-native smart contract implementing Token-2022 extensions
2. **KYC Oracle**: On-chain program to track verified users
3. **Compliance API**: Off-chain service for KYC verification and compliance
4. **Reserve Oracle**: Microservice for daily proof-of-reserve
5. **React Frontend**: User interface for minting, redeeming, and admin functions

## 🚀 Getting Started

### Prerequisites

- Solana CLI tools (1.17.0 or newer)
- Anchor Framework (0.30.0 or newer)
- Node.js (16.0.0 or newer)
- Yarn or npm

### Installation

1. Clone the repository

```bash
git clone https://github.com/yourusername/mica-eur.git
cd mica-eur
```

2. Install dependencies

```bash
# Install Anchor dependencies
yarn install

# Install Compliance API dependencies
cd app/compliance-api
yarn install

# Install Frontend dependencies
cd ../frontend
yarn install
```

3. Build the Anchor program

```bash
anchor build
```

4. Deploy to Solana devnet

```bash
anchor deploy --provider.cluster devnet
```

5. Start the Compliance API

```bash
cd app/compliance-api
yarn start
```

6. Start the frontend

```bash
cd app/frontend
yarn start
```

## 📚 Demo Scenarios

1. **Corporate Mint/Redeem**

   - KYC verification through Veriff
   - SEPA transfer to reserve account
   - Mint EUR tokens
   - Redeem back to bank account

2. **Admin Functions**

   - View/update proof-of-reserve
   - Freeze/unfreeze accounts
   - View compliance dashboard

3. **DvP (Delivery vs Payment)**
   - Atomic swap of EUR token for digital bond
   - Settlement finality in 400ms

## 🔐 Compliance & Security Considerations

- **DORA Compliance**: Built-in cyber resilience features
- **BaFin Integration**: API for regulatory actions
- **eWpG Compatibility**: Support for German electronic securities
- **Energy Disclosure**: Solana's energy-efficient PoS model

## 📄 License

MIT

## 👥 Team

- [Team Member 1] - Lead Developer
- [Team Member 2] - Smart Contract Specialist
- [Team Member 3] - Banking API Integration
- [Team Member 4] - Frontend Developer

## Environment Setup

This project uses dotenv.org vault for secure environment variable management across different environments (development, testing, production).

### Using the dotenv.org Vault

1. **Initial Setup**: Initialize the dotenv.org vault integration

   ```bash
   npm run setup:dotenv
   ```

   This will create necessary configuration files and set up your project with dotenv.org vault.

2. **Generate Test Keys**: Create test keypairs and store them securely in the dotenv.org vault

   ```bash
   npm run setup:test-keys
   ```

   This generates keypairs for various authorities (mint, freeze, regulatory, etc.) and stores them in the vault.

3. **Set Up Test Environment**: Configure and start a local Solana validator for testing

   ```bash
   # Basic setup
   npm run setup:test-env

   # With program build
   npm run setup:test-env -- --build
   ```

4. **Complete Setup**: Run all setup steps in sequence
   ```bash
   npm run setup:all
   ```

### Managing Environment Variables

- **Push Changes**: Update the dotenv.org vault with your local environment variables

  ```bash
  npm run dotenv:push         # Push development environment
  npm run dotenv:push:test    # Push test environment
  ```

- **Pull Changes**: Fetch the latest environment variables from the vault
  ```bash
  npm run dotenv:pull         # Pull development environment
  npm run dotenv:pull:test    # Pull test environment
  ```

### Why dotenv.org Vault?

- **Security**: Environment variables are encrypted and securely stored
- **Team Collaboration**: Share environment configurations without exposing secrets
- **Environment Separation**: Clear separation between development, test, and production environments
- **CI/CD Integration**: Securely inject environment variables in continuous integration workflows

For more information, visit [dotenv.org](https://dotenv.org/).

## Development Workflow

This project uses Husky and lint-staged for pre-commit hooks to ensure code quality:

1. **Linting**: All JS/TS files are linted with ESLint and formatted with Prettier
2. **Formatting**: Rust files are formatted with rustfmt
3. **Signature Verification**: Critical files must have properly signed changes
4. **Type Checking**: Function signatures are verified for proper typing
5. **Smoke Tests**: Fast tests are run to catch critical issues before commit
6. **Building**: The Anchor program is built to ensure it compiles

### Pre-commit Hooks

The pre-commit hook runs:

1. Lint staged files
2. Verify KYC verification levels across the codebase
3. Verify signatures in critical files (Rust program, scripts)
4. Verify type signatures in functions and programs
5. Build the Anchor program
6. Run fast tests including KYC end-to-end flow

These hooks ensure that any changes to the KYC verification levels are consistently applied across the codebase, including code, tests, and documentation. The KYC verification checks specifically validate:

- Consistency of verification level definitions
- Proper permissions for each verification level
- Documentation accuracy in the KYC flow guide
- Test coverage for all verification levels

You can test the pre-commit hooks without committing by running:

```bash
./scripts/test-precommit.sh
```

If any of these steps fail, the commit will be aborted.

### Bypassing Pre-commit Hooks

In some cases (like initial setup or emergency fixes), you may need to bypass pre-commit hooks. Use the force-commit script:

```bash
./scripts/force-commit.sh "Your commit message"
```

**Warning**: This should be used sparingly and only for good reasons. Always run the full test suite after using this.

### Code Signatures

Critical code files (like the Solana program code) should include a signature to verify their authenticity:

```rust
// Signature: Base64EncodedSignatureHere
pub fn important_function() -> Result<()> {
    // Function implementation
}
```

You can verify signatures using:

```bash
npm run verify:signatures
```

### Type Verification

Function signatures in both Rust and TypeScript should be properly typed. The type verification script checks for:

- Missing return types in Rust functions
- Missing parameter types in functions
- Use of 'any' type in TypeScript
- Missing derive macros on Rust structs

You can verify types using:

```bash
npm run verify:types
```

### CI/CD

GitHub Actions workflows are set up to run on push and pull requests:

1. `ci.yml`: Runs linting and formatting checks
2. `test.yml`: Builds the project and runs all tests

## Commerzbank MiCA EUR Stablecoin

This project implements a regulated stablecoin for the Euro according to the Markets in Crypto-Assets (MiCA) regulation.

Key Features:

- Token-2022 extensions for compliance
- KYC Oracle for user verification
- Freeze functionality for compliance actions
- Reserve proof verification
- Admin dashboard for regulatory oversight
