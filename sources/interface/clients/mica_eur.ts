import { Program } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import { MicaEur } from "../types/mica_eur";

export class MicaEurClient {
  constructor(public program: Program<MicaEur>, public programId: PublicKey) {}

  async initialize() {
    // Client method stubs
  }
}
