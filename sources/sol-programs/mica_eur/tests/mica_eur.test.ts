import { MicaEurClient } from "../../../interface/clients/mica_eur";
import * as anchor from "@project-serum/anchor";
import { MicaEur } from "../../../interface/types/mica_eur";

describe("mica_eur unit tests", () => {
  it("initializes correctly", async () => {
    const mockProgram = {
      simulate: {
        initialize: jest.fn(),
      },
    } as unknown as anchor.Program<MicaEur>;

    const client = new MicaEurClient(
      mockProgram,
      new anchor.web3.PublicKey("YourProgramIDHere")
    );
    // Test assertions
  });
});
