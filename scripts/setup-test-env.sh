#!/bin/bash

# MiCA EUR Test Environment Setup
# This script sets up a local validator and deploys the program for testing

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
BUILD=false
DOTENV_PULL=true

# Function to display script usage
function show_usage {
    echo -e "${BLUE}Usage:${NC} $0 [OPTIONS]"
    echo 
    echo "Options:"
    echo "  --help          Show this help message"
    echo "  --build         Build the program before deploying"
    echo "  --no-dotenv     Don't pull environment variables from dotenv.org vault"
    echo
    echo "Description:"
    echo "  This script sets up a local Solana validator for testing,"
    echo "  builds and deploys the MiCA EUR program, and configures"
    echo "  the environment for running tests."
    echo
    exit 1
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --help)
            show_usage
            ;;
        --build)
            BUILD=true
            shift
            ;;
        --no-dotenv)
            DOTENV_PULL=false
            shift
            ;;
        *)
            echo -e "${RED}Error:${NC} Unknown option: $1"
            show_usage
            ;;
    esac
done

# Check for .env file and attempt to load it
if [ -f .env ]; then
    echo -e "${GREEN}Loading environment variables from .env${NC}"
    source .env
elif [ -f .env.example ]; then
    echo -e "${YELLOW}No .env file found, copying from .env.example${NC}"
    cp .env.example .env
    source .env
else
    echo -e "${YELLOW}No .env file found, using default settings${NC}"
fi

# Pull environment variables from dotenv.org vault if enabled
if [ "$DOTENV_PULL" = true ]; then
    echo -e "${BLUE}Pulling test environment variables from dotenv.org vault...${NC}"
    npx dotenv-vault pull test || {
        echo -e "${YELLOW}Could not pull from dotenv.org vault, continuing with local env files${NC}"
    }
fi

# Set up environment
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# Check for Solana CLI installation
if ! command -v solana &> /dev/null; then
    echo -e "${RED}Error:${NC} Solana CLI is not installed. Please install it first."
    echo "Follow instructions at https://docs.solana.com/cli/install-solana-cli-tools"
    exit 1
fi

# Check if a local validator is already running
if solana config get | grep -q "http://127.0.0.1:8899"; then
    echo -e "${BLUE}Using existing local validator at http://127.0.0.1:8899${NC}"
else
    echo -e "${BLUE}Configuring Solana to use local validator...${NC}"
    solana config set --url localhost
fi

# Check if local validator is running
if ! solana cluster-version &> /dev/null; then
    echo -e "${BLUE}Starting local validator...${NC}"
    # Trap to ensure we kill the validator when the script exits
    trap 'kill $(jobs -p) 2>/dev/null' EXIT
    
    # Start local validator with test program
    solana-test-validator \
        --bpf-program 6EMQ3Ea56xesutRQ5FfXKEKiP2T7jzNr1SsxASNw6oAk ./target/deploy/spl_token_2022.so \
        --bpf-program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb ./target/deploy/spl_associated_token_account.so \
        --reset &
    
    # Wait for validator to start
    echo -e "${YELLOW}Waiting for local validator to start...${NC}"
    sleep 5
    until solana cluster-version &> /dev/null; do
        echo -e "${YELLOW}Validator still starting...${NC}"
        sleep 2
    done
    echo -e "${GREEN}Local validator is running!${NC}"
else
    echo -e "${GREEN}Local validator is already running${NC}"
fi

# Build the program if requested
if [ "$BUILD" = true ]; then
    echo -e "${BLUE}Building the program...${NC}"
    anchor build || {
        echo -e "${RED}Failed to build program${NC}"
        exit 1
    }
fi

# Deploy the program
echo -e "${BLUE}Deploying the program...${NC}"
anchor deploy || {
    echo -e "${RED}Failed to deploy program${NC}"
    exit 1
}

echo -e "${GREEN}Test environment setup complete!${NC}"
echo 
echo -e "${BLUE}To run tests, use:${NC}"
echo "  npm test"
echo
echo -e "${BLUE}To run a specific test, use:${NC}"
echo "  npm test -- -t \"test description\""
echo
echo -e "${BLUE}To stop the local validator when done, use:${NC}"
echo "  pkill solana-test-validator" 