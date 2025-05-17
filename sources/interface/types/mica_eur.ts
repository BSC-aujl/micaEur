import { Idl } from "@project-serum/anchor";

export interface MicaEur extends Idl {
  version: "0.1.0";
  name: "mica_eur";
  instructions: [
    {
      name: "initialize";
      accounts: [];
      args: [];
    }
  ];
}
