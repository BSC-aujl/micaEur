# MiCA EUR Tests

This directory contains tests for the MiCA EUR stablecoin implementation, covering all requirements for Milestone 1.1.

## Test Structure

The tests are organized in a three-tier structure:

1. **Unit Tests** (`tests/unit/`): Test individual components in isolation
2. **Integration Tests** (`tests/`): Test interactions between components
3. **Functional Tests** (`tests/functional/`): End-to-end tests for complete workflows

## Running the Tests

To run all tests:

```bash
npm run test:all
```

To run specific test categories:

```bash
# Run unit tests only
npm run test:unit

# Run KYC Oracle tests only
npm run test:kyc

# Run token mint tests only
npm run test:token
```

## Test Requirements Coverage

The test suite covers all requirements for Milestone 1.1 as detailed below.

### 1. Token-2022 Extensions Implementation

#### DefaultAccountState (Frozen by default)

- **Unit Tests**: `tests/unit/token_extensions.test.ts`
  - `Creates token accounts in frozen state` - Verifies new accounts are frozen by default
  - `Allows thawing accounts after KYC verification` - Tests thawing process

- **Functional Tests**: `tests/functional/regulatory_compliance.test.ts`
  - `Initializes the regulatory compliance environment` - Sets up DefaultAccountState
  - `Thaw accounts to allow transfers` - Tests thawing before transfers

#### TransferHook (KYC verification)

- **Unit Tests**: `tests/unit/token_extensions.test.ts`
  - `Initializes with the correct transfer hook program` - Verifies proper setup
  - `Enforces KYC verification for both sender and receiver` - Tests KYC requirements
  - `Enforces transaction limits based on KYC level` - Tests tier-based limits
  - `Logs transfer details for compliance tracking` - Tests audit trail

- **Functional Tests**: `tests/functional/transaction_limits.test.ts`
  - `Enforces per-transaction limits based on KYC level` - Tests tiered limits
  - `Enforces daily and monthly cumulative limits` - Tests time-based limits
  - `Prevents transfers to/from unverified accounts` - Tests KYC enforcement
  - `Logs transfers for compliance tracking` - Tests compliance tracking

#### PermanentDelegate (for regulatory compliance)

- **Unit Tests**: `tests/unit/token_extensions.test.ts` 
  - `Sets the correct permanent delegate on the mint` - Verifies setup
  - `Allows token seizure by the permanent delegate` - Tests seizure capability
  - `Prevents token seizure by unauthorized accounts` - Tests authorization

- **Unit Tests**: `tests/unit/freeze_seize.test.ts`
  - `Supports court-ordered seizure by regulatory delegate` - Tests regulatory seizure
  - `Maintains complete audit trail of seizure actions` - Tests audit capability
  - `Implements tiered approval for different seizure amounts` - Tests tiered approval

#### Metadata Pointer (for whitepaper and terms)

- **Unit Tests**: `tests/unit/token_extensions.test.ts`
  - `Sets the correct metadata pointer for the whitepaper` - Verifies setup
  - `Includes legal documentation that fulfills MiCA requirements` - Tests compliance

### 2. Mint/Redeem Functionality

#### Minting Process

- **Unit Tests**: `tests/unit/mint_redeem.test.ts`
  - `Allows authorized issuer to mint tokens to verified users` - Tests mint authorization
  - `Requires 1:1 backing with fiat EUR before minting` - Tests reserve requirement
  - `Prevents unauthorized issuers from minting tokens` - Tests authorization
  - `Enforces KYC verification level for minting` - Tests KYC requirements

#### Redemption Process

- **Unit Tests**: `tests/unit/mint_redeem.test.ts`
  - `Allows verified users to redeem tokens` - Tests redemption process
  - `Processes redemption within specified timeframe` - Tests timing requirements
  - `Enforces KYC verification before redemption` - Tests KYC requirements
  - `Updates reserve proof after redemption` - Tests reserve management

### 3. Freeze/Seize Capabilities

#### Account Freezing

- **Unit Tests**: `tests/unit/freeze_seize.test.ts`
  - `Allows regulatory authority to freeze suspicious accounts` - Tests freezing
  - `Logs all freeze actions for audit` - Tests audit capabilities
  - `Provides an unfreezing process with appropriate checks` - Tests unfreezing
  - `Prevents unauthorized freezing of accounts` - Tests authorization

#### Token Seizure

- **Unit Tests**: `tests/unit/freeze_seize.test.ts`
  - `Supports court-ordered seizure by regulatory delegate` - Tests court orders
  - `Maintains complete audit trail of seizure actions` - Tests audit trail
  - `Only allows authorized regulatory delegates to seize tokens` - Tests authorization

- **Functional Tests**: `tests/functional/regulatory_compliance.test.ts`
  - `Executes court-ordered seizure of tokens` - Tests complete seizure workflow

## KYC Oracle Tests

The KYC Oracle component is a critical part of the MiCA EUR implementation, as it enforces regulatory compliance through KYC verification. The KYC Oracle tests are detailed in:

- **Unit Tests**: `tests/unit/kyc_oracle.test.ts`
  - Tests KYC Oracle initialization
  - Tests user registration with different verification levels
  - Tests status updates (verification, rejection, revocation)
  - Tests verification checks and expiry

## Compliance Tracking

Compliance tracking is tested across various test files:

- **Unit Tests**: `tests/unit/freeze_seize.test.ts`
  - `Records reason codes for regulatory actions` - Tests reason tracking
  - `Provides compliance reports for regulatory actions` - Tests reporting
  - `Tracks risk factors for accounts` - Tests risk monitoring

- **Functional Tests**: `tests/functional/transaction_limits.test.ts`
  - `Logs transfers for compliance tracking` - Tests event emission

## Reserve Management

Reserve management is a critical requirement for MiCA compliance, ensuring 1:1 backing of the stablecoin:

- **Unit Tests**: `tests/unit/mint_redeem.test.ts`
  - `Maintains proper reserve ratio` - Tests 1:1 backing
  - `Updates reserve proof with correct information` - Tests proof updates
  - `Prevents manipulation of reserve proof` - Tests security

- **Functional Tests**: `tests/functional/regulatory_compliance.test.ts`
  - `Maintains reserve proofs for regulatory compliance` - Tests reserve reporting

## Notes on Test Implementation

The test files contain placeholders in some places marked with:
- `TODO` comments for future implementation details
- `console.log` statements explaining what would be tested in a complete implementation
- Some tests simulate functionality that would require time manipulation or blockchain state changes

These placeholders are intentional and should be replaced with actual implementations as the codebase develops. 