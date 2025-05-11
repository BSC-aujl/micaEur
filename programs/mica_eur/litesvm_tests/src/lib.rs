use litesvm::{ProgramTestContext, ProgramTest};
use anchor_lang::solana_program::{pubkey::Pubkey, system_instruction};
use solana_sdk::{signature::Keypair, transaction::Transaction};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_litesvm_setup() {
        let program_id = Pubkey::new_unique();
        
        let mut program_test = ProgramTest::new("mica_eur", program_id, None);
        let payer = Keypair::new();
        
        program_test.add_account(
            payer.pubkey(),
            solana_sdk::account::Account {
                lamports: 1_000_000_000, // 1 SOL
                data: vec![],
                owner: solana_sdk::system_program::id(),
                executable: false,
                rent_epoch: 0,
            },
        );
        
        let mut context = program_test.start_with_context();
        println!("LiteSVM context successfully created!");
        
        // Send a simple transaction to verify everything is working
        let recipient = Pubkey::new_unique();
        let transfer_ix = system_instruction::transfer(
            &payer.pubkey(),
            &recipient,
            100_000, // 0.0001 SOL
        );
        
        let tx = Transaction::new_signed_with_payer(
            &[transfer_ix],
            Some(&payer.pubkey()),
            &[&payer],
            context.last_blockhash,
        );
        
        context.banks_client.process_transaction(tx).unwrap();
        println!("Transaction successfully processed!");
        
        // Verify balances
        let recipient_account = context.banks_client.get_account(recipient).unwrap().unwrap();
        assert_eq!(recipient_account.lamports, 100_000);
        println!("Recipient balance verification passed!");
    }
} 