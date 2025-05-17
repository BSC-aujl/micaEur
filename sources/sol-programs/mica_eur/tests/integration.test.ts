import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { MicaEur } from "../../../interface/types/mica_eur";

describe("mica_eur integration tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program: any = anchor.workspace.MicaEur;

  it("initializes program", async () => {
    // Integration test logic
  });
});
