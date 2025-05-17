import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { MicaEur } from "../../../interface/types/mica_eur";

describe("mica_eur integration tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.MicaEur as Program<MicaEur>;

  it("initializes program", async () => {
    // Integration test logic
  });
});
