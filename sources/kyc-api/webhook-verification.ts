import * as crypto from "crypto";

/**
 * Verify Onfido webhook signature using HMAC SHA-256.
 * @param payload Raw JSON string of the webhook body
 * @param signature Signature from the 'x-signature' header
 * @param webhookToken Shared secret for hashing
 * @returns Whether the signature is valid
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  webhookToken: string
): boolean {
  const hmac = crypto.createHmac("sha256", webhookToken);
  const expectedSignature = hmac.update(payload).digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, "utf-8"),
      Buffer.from(expectedSignature, "utf-8")
    );
  } catch {
    return false;
  }
}
