import { MicaEurClient } from "../../../interface/clients/mica_eur";
import * as anchor from "@coral-xyz/anchor";
import { MicaEur } from "../../../interface/types/mica_eur";
import { jest } from "@jest/globals";

describe("mica_eur unit tests", () => {
  it("initializes correctly", async () => {
    const mockProgram: any = {
      simulate: {
        initialize: jest.fn(),
      },
    };

    const client = new MicaEurClient(
      mockProgram,
      new anchor.web3.PublicKey("YourProgramIDHere")
    );
    // Test assertions
  });
});
