import * as anchor from "@project-serum/anchor";

export const config = {
  programId: "9x3tkUkajECAgPvS59YTAdD7VZRMRckrPxFC4MZspup5",
  connection: new anchor.web3.Connection("http://localhost:8899"),
};

// Export PROGRAM_ID for test imports
export const PROGRAM_ID = new anchor.web3.PublicKey(config.programId);
