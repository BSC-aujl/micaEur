# Git Hooks

This directory contains Git hooks managed by Husky.

## Pre-commit Hook

The pre-commit hook runs several checks before allowing a commit to proceed:

### Critical Checks (always run)

1. **KYC Verification Check** (`npm run verify:kyc`)
   - Verifies that KYC verification levels are properly configured
   - Ensures alignment between on-chain and off-chain KYC parameters

2. **Transaction Signature Safety** (`npm run verify:signatures`)
   - Checks for proper transaction signature handling
   - Ensures transactions are properly confirmed and errors are handled

3. **TypeScript Type Checking** (`npm run verify:types`)
   - Runs the TypeScript compiler in type-checking mode
   - Ensures all types are correctly defined and used

### Full Pre-commit Checks

These checks run unless `SKIP_FULL_PRECOMMIT=1` is set:

1. **Linting** (`npm run lint`)
   - Runs ESLint to check for code style issues
   - Runs Prettier to ensure consistent formatting

2. **Fast Build Check** (`npm run build:fast`)
   - Performs a quick build with --skip-lint flag
   - Ensures the program compiles without errors

3. **Critical Tests** (`npm run test:precommit`)
   - Runs a subset of critical tests to ensure core functionality works
   - Includes KYC Oracle tests and other essential functionality

## Usage

### Skipping Full Pre-commit Checks

If you need to commit quickly and skip the longer-running checks:

```bash
SKIP_FULL_PRECOMMIT=1 git commit -m "Your commit message"
```

### Installing Hooks

The hooks are automatically installed when you run `npm install` due to the `prepare` script in package.json.

If you need to manually install the hooks:

```bash
npx husky install
```

### Troubleshooting

If a pre-commit hook is failing:

1. Check the error message to identify the failing script
2. Run the specific check manually (e.g., `npm run verify:kyc`)
3. Fix the identified issues
4. Try committing again 