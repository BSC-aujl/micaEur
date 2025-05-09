FROM ubuntu:22.04

# Install basic dependencies
RUN apt-get update && apt-get install -y \
    curl git build-essential pkg-config libssl-dev libudev-dev \
    python3 clang cmake

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install stable Rust version 1.68.0
RUN rustup install 1.68.0 && rustup default 1.68.0

# Install Solana 1.16.23
RUN sh -c "$(curl -sSfL https://release.solana.com/v1.16.23/install)"
ENV PATH="/root/.local/share/solana/install/active_release/bin:${PATH}"

# Install Anchor 0.28.0
RUN cargo install --git https://github.com/coral-xyz/anchor --tag v0.28.0 anchor-cli --locked

# Set up working directory
WORKDIR /app

# Copy project files
COPY . .

# Build the project
CMD ["anchor", "build"] 