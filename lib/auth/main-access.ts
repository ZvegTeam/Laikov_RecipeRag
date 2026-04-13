import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const MAIN_ACCESS_COOKIE_NAME = "main_access";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

/**
 * Expected ACCESS_PASSWORD_HASH format:
 * scrypt$<salt_hex>$<hash_hex>
 */
export function verifyMainAccessPassword(password: string): boolean {
  const rawHash = getRequiredEnv("ACCESS_PASSWORD_HASH");
  const [algo, saltHex, expectedHashHex] = rawHash.split("$");
  if (algo !== "scrypt" || !saltHex || !expectedHashHex) {
    throw new Error("Invalid ACCESS_PASSWORD_HASH format. Expected: scrypt$<salt_hex>$<hash_hex>");
  }

  const salt = Buffer.from(saltHex, "hex");
  const expectedHash = Buffer.from(expectedHashHex, "hex");
  const actualHash = scryptSync(password, salt, expectedHash.length);

  return timingSafeEqual(actualHash, expectedHash);
}

function signToken(payload: string): string {
  const secret = getRequiredEnv("ACCESS_COOKIE_SECRET");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createMainAccessToken(): string {
  const nonce = randomBytes(16).toString("hex");
  const payload = `ok:${nonce}`;
  const signature = signToken(payload);
  return `${payload}.${signature}`;
}

export function isMainAccessTokenValid(token: string): boolean {
  const dotIndex = token.lastIndexOf(".");
  if (dotIndex <= 0) return false;

  const payload = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);
  const expectedSignature = signToken(payload);

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch {
    return false;
  }
}

export function hasMainPageAccess(cookies: {
  get(name: string): { value: string } | undefined;
}): boolean {
  const token = cookies.get(MAIN_ACCESS_COOKIE_NAME)?.value;
  if (!token) return false;
  return isMainAccessTokenValid(token);
}
