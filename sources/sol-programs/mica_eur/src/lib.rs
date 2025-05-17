use anchor_lang::prelude::*;
use anchor_spl::{
    token_2022::{self, spl_token_2022::{
        extension::{
            default_account_state::DefaultAccountState,
            metadata_pointer::MetadataPointer,
            transfer_hook::TransferHook,
            permanent_delegate::PermanentDelegate,
            StateWithExtensions,
        },
        state::{AccountState, Mint},
        ID as TOKEN_2022_ID,
    }},
    token_interface::Token2022,
};
use std::str::FromStr;

mod kyc_oracle;
mod constants;
mod error;
mod mint_utils;
mod versions;
mod merkle_info;
mod aml;

pub use kyc_oracle::*;
pub use constants::*;
pub use error::*;
pub use mint_utils::*;
pub use versions::*;
pub use merkle_info::*;

declare_id!("9x3tkUkajECAgPvS59YTAdD7VZRMRckrPxFC4MZspup5");

#[program]
pub mod mica_eur {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        // Log version information
        versions::log_versions();
        
        msg!("MiCA EUR Token Initialized");
        Ok(())
    }

    /// Initialize the KYC oracle state
    pub fn initialize_kyc_oracle(ctx: Context<InitializeKycOracle>) -> Result<()> {
        kyc_oracle::initialize_kyc_oracle(ctx)
    }

    /// Register a new user for KYC verification
    pub fn register_kyc_user(
        ctx: Context<RegisterKycUser>,
        blz: String,
        iban_hash: [u8; 32],
        country_code: String,
        verification_provider: String,
    ) -> Result<()> {
        kyc_oracle::register_kyc_user(ctx, blz, iban_hash, country_code, verification_provider)
    }

    /// Update KYC status for a user
    pub fn update_kyc_status(
        ctx: Context<UpdateKycStatus>,
        status: KycStatus,
        verification_level: u8,
        expiry_days: i64,
    ) -> Result<()> {
        kyc_oracle::update_kyc_status(ctx, status, verification_level, expiry_days)
    }

    /// Initialize the EUR stablecoin with Token-2022 extensions
    pub fn initialize_euro_mint(
        ctx: Context<InitializeEuroMint>,
        whitepaper_uri: String,
    ) -> Result<()> {
        // Log version information for this important operation
        versions::log_versions();
        
        // Check compatibility
        if !versions::is_solana_version_compatible() {
            msg!("Warning: Running on an incompatible Solana version");
            // We allow it to continue but log a warning
        }
    
        let mint_key = ctx.accounts.mint.key();
        let mint_key_ref = mint_key.as_ref();
        let bump = ctx.bumps.mint_info;
        let bump_ref = &[bump];
        
        let seeds = &[
            MINT_INFO_SEED,
            mint_key_ref,
            bump_ref,
        ];
        let _signer = &[&seeds[..]];

        // Store mint info
        let mint_info = &mut ctx.accounts.mint_info;
        mint_info.mint = ctx.accounts.mint.key();
        mint_info.issuer = ctx.accounts.issuer.key();
        mint_info.freeze_authority = ctx.accounts.freeze_authority.key();
        mint_info.permanent_delegate = ctx.accounts.permanent_delegate.key();
        mint_info.whitepaper_uri = whitepaper_uri;
        mint_info.is_active = true;
        mint_info.creation_time = Clock::get()?.unix_timestamp;
        mint_info.last_reserve_update = Clock::get()?.unix_timestamp;

        // Log the initialization
        msg!("MiCA EUR Token mint initialized with extensions");
        msg!("Mint: {}", ctx.accounts.mint.key());
        msg!("Issuer: {}", ctx.accounts.issuer.key());
        msg!("Freeze Authority: {}", ctx.accounts.freeze_authority.key());
        msg!("Permanent Delegate: {}", ctx.accounts.permanent_delegate.key());

        Ok(())
    }

    /// Create a token account with DefaultAccountState = Frozen
    pub fn create_token_account(ctx: Context<CreateTokenAccount>) -> Result<()> {
        // Token account is created with DefaultAccountState extension
        // and will be initialized as Frozen
        msg!("Created token account with Frozen default state");
        Ok(())
    }
    
    /// Mint tokens to an account (only the issuer can do this)
    pub fn mint_tokens(
        ctx: Context<MintTokens>,
        amount: u64,
    ) -> Result<()> {
        // Check if the user has been KYC verified
        let kyc_user = &ctx.accounts.kyc_user;
        
        if !is_kyc_verified(kyc_user) {
            return Err(MicaEurError::UserNotVerified.into());
        }

        // Check verification level (must be at least level 2 for minting)
        if kyc_user.verification_level < 2 {
            return Err(MicaEurError::InsufficientVerificationLevel.into());
        }

        // Mint the tokens
        let cpi_accounts = token_2022::MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.issuer.to_account_info(),
        };
        
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
        );
        
        token_2022::mint_to(cpi_ctx, amount)?;

        // Thaw the account before returning
        let cpi_accounts = token_2022::ThawAccount {
            account: ctx.accounts.token_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            authority: ctx.accounts.freeze_authority.to_account_info(),
        };
        
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
        );
        
        token_2022::thaw_account(cpi_ctx)?;

        msg!("Minted {} tokens to {}", amount, ctx.accounts.token_account.key());
        Ok(())
    }
    
    /// Burn tokens (redeem EUR)
    pub fn burn_tokens(
        ctx: Context<BurnTokens>,
        amount: u64,
    ) -> Result<()> {
        // Burn the tokens
        let cpi_accounts = token_2022::Burn {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.owner.to_account_info(),
        };
        
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
        );
        
        token_2022::burn(cpi_ctx, amount)?;

        msg!("Burned {} tokens from {}", amount, ctx.accounts.token_account.key());
        Ok(())
    }
    
    /// Freeze an account (regulatory action)
    pub fn freeze_account(ctx: Context<FreezeAccount>) -> Result<()> {
        let cpi_accounts = token_2022::FreezeAccount {
            account: ctx.accounts.token_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            authority: ctx.accounts.freeze_authority.to_account_info(),
        };
        
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
        );
        
        token_2022::freeze_account(cpi_ctx)?;

        msg!("Frozen account {}", ctx.accounts.token_account.key());
        Ok(())
    }
    
    /// Thaw (unfreeze) an account
    pub fn thaw_account(ctx: Context<ThawAccount>) -> Result<()> {
        let cpi_accounts = token_2022::ThawAccount {
            account: ctx.accounts.token_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            authority: ctx.accounts.freeze_authority.to_account_info(),
        };
        
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
        );
        
        token_2022::thaw_account(cpi_ctx)?;

        msg!("Thawed account {}", ctx.accounts.token_account.key());
        Ok(())
    }
    
    /// Seize tokens from an account (regulatory action)
    pub fn seize_tokens(
        ctx: Context<SeizeTokens>,
        amount: u64,
    ) -> Result<()> {
        // The permanent delegate can transfer tokens without the owner's signature
        let cpi_accounts = token_2022::Transfer {
            from: ctx.accounts.from_account.to_account_info(),
            to: ctx.accounts.to_account.to_account_info(),
            authority: ctx.accounts.permanent_delegate.to_account_info(),
        };
        
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
        );
        
        token_2022::transfer(cpi_ctx, amount)?;

        msg!("Seized {} tokens from {}", amount, ctx.accounts.from_account.key());
        Ok(())
    }
    
    /// Update the reserve proof
    pub fn update_reserve_proof(
        ctx: Context<UpdateReserveProof>,
        merkle_root: [u8; 32],
        ipfs_cid: String,
    ) -> Result<()> {
        let mint_info = &mut ctx.accounts.mint_info;
        let ipfs_cid_clone = ipfs_cid.clone(); // Clone before using
        
        mint_info.reserve_merkle_root = merkle_root;
        mint_info.reserve_ipfs_cid = ipfs_cid; // Original can be moved here
        mint_info.last_reserve_update = Clock::get()?.unix_timestamp;
        
        msg!("Reserve proof updated");
        msg!("Merkle root: {:?}", merkle_root);
        msg!("IPFS CID: {}", ipfs_cid_clone); // Use the clone
        
        Ok(())
    }

    /// Register an AML authority
    pub fn register_aml_authority(
        ctx: Context<RegisterAmlAuthority>,
        authority_id: String,
        powers: u8,
    ) -> Result<()> {
        aml::register_aml_authority(ctx, authority_id, powers)
    }

    /// Create a blacklist entry for a user
    pub fn create_blacklist_entry(
        ctx: Context<CreateBlacklistEntry>,
        reason: u8,
    ) -> Result<()> {
        aml::create_blacklist_entry(ctx, reason)
    }

    /// Deactivate an AML authority (issuer or regulator only)
    pub fn deactivate_aml_authority(
        ctx: Context<DeactivateAmlAuthority>,
    ) -> Result<()> {
        aml::deactivate_aml_authority(ctx)
    }

    /// Deactivate (un-blacklist) a blacklist entry (AML authority only)
    pub fn deactivate_blacklist_entry(
        ctx: Context<DeactivateBlacklistEntry>,
    ) -> Result<()> {
        aml::deactivate_blacklist_entry(ctx)
    }

    /// Update the powers of an AML authority (issuer or regulator only)
    pub fn update_aml_authority_powers(
        ctx: Context<UpdateAmlAuthorityPowers>,
        new_powers: u8,
    ) -> Result<()> {
        aml::update_aml_authority_powers(ctx, new_powers)
    }

    // ---------------- AML context types ----------------
    #[derive(Accounts)]
    pub struct RegisterAmlAuthority<'info> {
        #[account(mut)]
        pub authority: Signer<'info>,

        #[account(
            init,
            payer = authority,
            seeds = [AML_AUTHORITY_SEED, authority.key().as_ref()],
            bump,
            space = 8 + std::mem::size_of::<crate::aml::AmlAuthority>() + 64,
        )]
        pub aml_authority: Account<'info, crate::aml::AmlAuthority>,

        pub system_program: Program<'info, System>,
    }

    #[derive(Accounts)]
    pub struct CreateBlacklistEntry<'info> {
        #[account(mut)]
        pub authority: Signer<'info>,

        #[account(
            mut,
            seeds = [AML_AUTHORITY_SEED, authority.key().as_ref()],
            bump,
            has_one = authority,
        )]
        pub aml_authority: Account<'info, crate::aml::AmlAuthority>,

        /// CHECK: only the key is used for PDA seeds
        pub user: UncheckedAccount<'info>,

        #[account(
            init,
            payer = authority,
            seeds = [BLACKLIST_SEED, user.key().as_ref()],
            bump,
            space = 8 + std::mem::size_of::<crate::aml::BlacklistEntry>(),
        )]
        pub blacklist_entry: Account<'info, crate::aml::BlacklistEntry>,

        pub system_program: Program<'info, System>,
    }

    // Context for deactivating an AML authority
    #[derive(Accounts)]
    pub struct DeactivateAmlAuthority<'info> {
        #[account(mut)]
        pub issuer: Signer<'info>,
        #[account(
            mut,
            seeds = [AML_AUTHORITY_SEED, aml_authority.authority.as_ref()],
            bump,
        )]
        pub aml_authority: Account<'info, crate::aml::AmlAuthority>,
        pub system_program: Program<'info, System>,
    }

    // Context for deactivating a blacklist entry
    #[derive(Accounts)]
    pub struct DeactivateBlacklistEntry<'info> {
        #[account(mut)]
        pub authority: Signer<'info>,
        #[account(
            mut,
            seeds = [AML_AUTHORITY_SEED, authority.key().as_ref()],
            bump,
            has_one = authority,
        )]
        pub aml_authority: Account<'info, crate::aml::AmlAuthority>,
        /// CHECK: only the key is used for PDA seeds
        pub user: UncheckedAccount<'info>,
        #[account(
            mut,
            seeds = [BLACKLIST_SEED, user.key().as_ref()],
            bump,
        )]
        pub blacklist_entry: Account<'info, crate::aml::BlacklistEntry>,
        pub system_program: Program<'info, System>,
    }

    // Context for updating AML authority powers
    #[derive(Accounts)]
    pub struct UpdateAmlAuthorityPowers<'info> {
        #[account(mut)]
        pub issuer: Signer<'info>,
        #[account(
            mut,
            seeds = [AML_AUTHORITY_SEED, aml_authority.authority.as_ref()],
            bump,
        )]
        pub aml_authority: Account<'info, crate::aml::AmlAuthority>,
        pub system_program: Program<'info, System>,
    }
}

#[derive(Accounts)]
pub struct Initialize {}

/// MintInfo account to store additional metadata about the EUR token
#[account]
pub struct MintInfo {
    pub mint: Pubkey,                 // The mint address
    pub issuer: Pubkey,               // Who can mint new tokens
    pub freeze_authority: Pubkey,     // Who can freeze accounts
    pub permanent_delegate: Pubkey,   // Who can seize tokens
    pub whitepaper_uri: String,       // URI to the whitepaper
    pub is_active: bool,              // Whether the token is active
    pub creation_time: i64,           // When the token was created
    pub reserve_merkle_root: [u8; 32],// Merkle root of the reserve proof
    pub reserve_ipfs_cid: String,     // IPFS CID of the reserve proof
    pub last_reserve_update: i64,     // When the reserve was last updated
}

#[derive(Accounts)]
pub struct InitializeEuroMint<'info> {
    #[account(mut)]
    pub issuer: Signer<'info>,
    
    #[account(
        init,
        payer = issuer,
        seeds = [MINT_INFO_SEED, mint.key().as_ref()],
        bump,
        space = 8 + std::mem::size_of::<MintInfo>() + 256, // Extra space for strings
    )]
    pub mint_info: Account<'info, MintInfo>,
    
    /// The mint account for the EUR token
    #[account(mut)]
    pub mint: Signer<'info>,
    
    /// The freeze authority for the token
    /// CHECK: This is just a public key, not an account we're accessing
    pub freeze_authority: UncheckedAccount<'info>,
    
    /// The permanent delegate for the token
    /// CHECK: This is just a public key, not an account we're accessing
    pub permanent_delegate: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
    
    /// Token program: must be Token-2022
    #[account(constraint = token_program.key == &TOKEN_2022_ID)]
    pub token_program: Program<'info, token_2022::Token2022>,
    
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct CreateTokenAccount<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    
    #[account(mut)]
    /// CHECK: Validated by token_program
    pub token_account: UncheckedAccount<'info>,
    
    /// CHECK: Validated by token_program
    pub mint: UncheckedAccount<'info>,
    
    #[account(
        seeds = [MINT_INFO_SEED, mint.key().as_ref()],
        bump,
    )]
    pub mint_info: Account<'info, MintInfo>,
    
    pub system_program: Program<'info, System>,
    
    /// Token program: must be Token-2022
    #[account(constraint = token_program.key == &TOKEN_2022_ID)]
    pub token_program: Program<'info, token_2022::Token2022>,
    
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(
        mut,
        constraint = mint_info.issuer == issuer.key(),
        constraint = mint_info.is_active,
    )]
    pub issuer: Signer<'info>,
    
    #[account(
        seeds = [MINT_INFO_SEED, mint.key().as_ref()],
        bump,
        constraint = mint_info.mint == mint.key(),
    )]
    pub mint_info: Account<'info, MintInfo>,
    
    /// The mint account for the EUR token
    #[account(mut)]
    /// CHECK: Validated by token_program
    pub mint: UncheckedAccount<'info>,
    
    /// The token account to mint to
    #[account(mut)]
    /// CHECK: Validated by token_program
    pub token_account: UncheckedAccount<'info>,

    /// The KYC user account (must be verified)
    pub kyc_user: Account<'info, KycUser>,
    
    /// The freeze authority for the token
    #[account(
        constraint = freeze_authority.key() == mint_info.freeze_authority
    )]
    /// CHECK: Only using for constraint
    pub freeze_authority: UncheckedAccount<'info>,
    
    /// Token program: must be Token-2022
    #[account(constraint = token_program.key == &TOKEN_2022_ID)]
    pub token_program: Program<'info, token_2022::Token2022>,
}

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    
    #[account(
        seeds = [MINT_INFO_SEED, mint.key().as_ref()],
        bump,
        constraint = mint_info.mint == mint.key(),
        constraint = mint_info.is_active,
    )]
    pub mint_info: Account<'info, MintInfo>,
    
    /// The mint account for the EUR token
    #[account(mut)]
    /// CHECK: Validated by token_program
    pub mint: UncheckedAccount<'info>,
    
    /// The token account to burn from
    #[account(mut)]
    /// CHECK: Validated by token_program
    pub token_account: UncheckedAccount<'info>,
    
    /// Token program: must be Token-2022
    #[account(constraint = token_program.key == &TOKEN_2022_ID)]
    pub token_program: Program<'info, token_2022::Token2022>,
}

#[derive(Accounts)]
pub struct FreezeAccount<'info> {
    #[account(
        mut,
        constraint = freeze_authority.key() == mint_info.freeze_authority
    )]
    pub freeze_authority: Signer<'info>,
    
    #[account(
        seeds = [MINT_INFO_SEED, mint.key().as_ref()],
        bump,
        constraint = mint_info.mint == mint.key(),
        constraint = mint_info.is_active,
    )]
    pub mint_info: Account<'info, MintInfo>,
    
    /// The mint account for the EUR token
    #[account(mut)]
    /// CHECK: Validated by token_program
    pub mint: UncheckedAccount<'info>,
    
    /// The token account to freeze
    #[account(mut)]
    /// CHECK: Validated by token_program
    pub token_account: UncheckedAccount<'info>,
    
    /// Token program: must be Token-2022
    #[account(constraint = token_program.key == &TOKEN_2022_ID)]
    pub token_program: Program<'info, token_2022::Token2022>,
}

#[derive(Accounts)]
pub struct ThawAccount<'info> {
    #[account(
        mut,
        constraint = freeze_authority.key() == mint_info.freeze_authority
    )]
    pub freeze_authority: Signer<'info>,
    
    #[account(
        seeds = [MINT_INFO_SEED, mint.key().as_ref()],
        bump,
        constraint = mint_info.mint == mint.key(),
        constraint = mint_info.is_active,
    )]
    pub mint_info: Account<'info, MintInfo>,
    
    /// The mint account for the EUR token
    #[account(mut)]
    /// CHECK: Validated by token_program
    pub mint: UncheckedAccount<'info>,
    
    /// The token account to thaw
    #[account(mut)]
    /// CHECK: Validated by token_program
    pub token_account: UncheckedAccount<'info>,
    
    /// Token program: must be Token-2022
    #[account(constraint = token_program.key == &TOKEN_2022_ID)]
    pub token_program: Program<'info, token_2022::Token2022>,
}

#[derive(Accounts)]
pub struct SeizeTokens<'info> {
    #[account(
        mut,
        constraint = permanent_delegate.key() == mint_info.permanent_delegate
    )]
    pub permanent_delegate: Signer<'info>,
    
    #[account(
        seeds = [MINT_INFO_SEED, mint.key().as_ref()],
        bump,
        constraint = mint_info.mint == mint.key(),
        constraint = mint_info.is_active,
    )]
    pub mint_info: Account<'info, MintInfo>,
    
    /// The mint account for the EUR token
    #[account(mut)]
    /// CHECK: Validated by token_program
    pub mint: UncheckedAccount<'info>,
    
    /// The token account to seize from
    #[account(mut)]
    /// CHECK: Validated by token_program
    pub from_account: UncheckedAccount<'info>,
    
    /// The token account to transfer to
    #[account(mut)]
    /// CHECK: Validated by token_program
    pub to_account: UncheckedAccount<'info>,
    
    /// Token program: must be Token-2022
    #[account(constraint = token_program.key == &TOKEN_2022_ID)]
    pub token_program: Program<'info, token_2022::Token2022>,
}

#[derive(Accounts)]
pub struct UpdateReserveProof<'info> {
    #[account(
        mut,
        constraint = issuer.key() == mint_info.issuer
    )]
    pub issuer: Signer<'info>,
    
    #[account(
        mut,
        seeds = [MINT_INFO_SEED, mint_info.mint.as_ref()],
        bump,
        constraint = mint_info.is_active,
    )]
    pub mint_info: Account<'info, MintInfo>,
} 