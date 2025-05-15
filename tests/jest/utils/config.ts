import { PublicKey } from "@solana/web3.js";
import idl from "../../../target/idl/mica_eur.json";

export const PROGRAM_ID = new PublicKey(idl.address);
