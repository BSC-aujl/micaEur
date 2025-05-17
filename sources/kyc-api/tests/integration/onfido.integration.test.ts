import "dotenv/config";
import { expect } from "chai";
import request from "supertest";
import nacl from "tweetnacl";
import * as crypto from "crypto";
import { Keypair } from "@solana/web3.js";
import app from "../../index";

describe("Onfido KYC API Integration (Sandbox)", function (this: any) {
  this.timeout(60000);

  let wallet: Keypair;
  let applicantId: string;

  it("should initiate KYC process", async () => {
    wallet = Keypair.generate();
    const res = await request(app)
      .post("/api/kyc/initiate")
      .send({
        walletAddress: wallet.publicKey.toString(),
        firstName: "Jane",
        lastName: "Doe",
        email: "jane.doe+sandbox@example.com",
      })
      .expect(200);

    expect(res.body).to.have.property("applicantId");
    expect(res.body).to.have.property("sdkToken");
    expect(res.body.sdkToken).to.be.a("string");
    applicantId = res.body.applicantId;
  });

  it("should verify the user signature", async () => {
    const message = `I am initiating KYC verification for wallet ${wallet.publicKey.toString()}`;
    const signature = nacl.sign.detached(
      Buffer.from(message),
      wallet.secretKey
    );
    const signatureBase64 = Buffer.from(signature).toString("base64");

    const res = await request(app)
      .post("/api/kyc/verify-signature")
      .send({
        walletAddress: wallet.publicKey.toString(),
        signature: signatureBase64,
        applicantId,
      })
      .expect(200);

    expect(res.body).to.deep.equal({ success: true });
  });

  it("should process Onfido webhook and update on-chain status", async () => {
    // Simulate webhook payload from Onfido sandbox
    const payload = {
      payload: {
        resource_type: "check",
        action: "completed",
        object: { applicant_id: applicantId, result: "clear" },
      },
    };
    const payloadRaw = JSON.stringify(payload);
    const signature = crypto
      .createHmac("sha256", process.env.ONFIDO_WEBHOOK_TOKEN!)
      .update(payloadRaw)
      .digest("hex");

    const res = await request(app)
      .post("/api/kyc/webhook")
      .set("x-signature", signature)
      .send(payload)
      .expect(200);

    expect(res.body).to.have.property("status", "success");
  });
});
