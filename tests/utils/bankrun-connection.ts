import { ProgramTestContext } from "solana-bankrun";
import {
  Connection,
  Commitment,
  BlockhashWithExpiryBlockHeight,
  TransactionSignature,
  Transaction,
  VersionedTransaction
} from "@solana/web3.js";

/**
 * A minimal Connection shim that routes RPC calls into a Bankrun client.
 */
export class BankrunConnection extends Connection {
  ctx: ProgramTestContext;

  constructor(ctx: ProgramTestContext) {
    // We don't use HTTP at all; pass dummy URL
    super("http://localhost:8899");
    this.ctx = ctx;
  }

  /** Override latest blockhash retrieval */
  override async getLatestBlockhash(commitment?: Commitment): Promise<BlockhashWithExpiryBlockHeight> {
    const [blockhash, lastValid] = await this.ctx.banksClient.getLatestBlockhash(commitment);
    return { blockhash, lastValidBlockHeight: Number(lastValid) };
  }

  /** Override sendRawTransaction to use Bankrun's client */
  override async sendRawTransaction(rawTx: Buffer, _options?: Record<string, unknown>): Promise<TransactionSignature> {
    // Deserialize the raw bytes into a Transaction or VersionedTransaction
    let txObj: Transaction | VersionedTransaction;
    try {
      txObj = Transaction.from(rawTx);
    } catch {
      txObj = VersionedTransaction.deserialize(rawTx);
    }
    // Process the transaction through Bankrun
    await this.ctx.banksClient.processTransaction(txObj);
    // Return the last known blockhash as a pseudo-signature
    return this.ctx.lastBlockhash;
  }

  /** Always return immediate success since Bankrun has no RPC delay */
  override async confirmTransaction(
    _strategy: unknown,
    _commitment?: Commitment
  ): Promise<{ context: { slot: number }, value: { err: null | string } }> {
    return {
      context: { slot: 0 },
      value: { err: null }
    };
  }
} 