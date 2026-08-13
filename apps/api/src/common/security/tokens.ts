import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function createOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string, secret?: string): string {
  return secret
    ? createHmac("sha256", secret).update(token, "utf8").digest("hex")
    : createHash("sha256").update(token, "utf8").digest("hex");
}

export function safeEqualText(left: string, right: string): boolean {
  const leftBuffer = createHash("sha256").update(left, "utf8").digest();
  const rightBuffer = createHash("sha256").update(right, "utf8").digest();
  return timingSafeEqual(leftBuffer, rightBuffer);
}
