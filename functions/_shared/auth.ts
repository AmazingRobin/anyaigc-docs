/**
 * Auth utilities using Web Crypto API (HMAC-SHA256)
 * Compatible with Cloudflare Workers runtime
 */

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

async function getKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes.buffer;
}

/**
 * Creates a signed HMAC token with a 24h expiry.
 * Format: <exp>.<signature_hex>
 */
export async function createToken(secret: string): Promise<string> {
  const exp = Date.now() + TOKEN_EXPIRY_MS;
  const payload = String(exp);
  const key = await getKey(secret);
  const enc = new TextEncoder();
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return `${payload}.${bufferToHex(sig)}`;
}

/**
 * Verifies a token created by createToken.
 * Returns true if the signature is valid and the token has not expired.
 */
export async function verifyToken(token: string, secret: string): Promise<boolean> {
  try {
    const dotIndex = token.lastIndexOf(".");
    if (dotIndex === -1) return false;

    const payload = token.slice(0, dotIndex);
    const sigHex = token.slice(dotIndex + 1);

    const exp = Number(payload);
    if (!Number.isFinite(exp) || Date.now() > exp) return false;

    const key = await getKey(secret);
    const enc = new TextEncoder();
    const sigBuffer = hexToBuffer(sigHex);
    return await crypto.subtle.verify("HMAC", key, sigBuffer, enc.encode(payload));
  } catch {
    return false;
  }
}
