const SECRET = process.env.AUTH_JWT_SECRET || "tracia-demo-secret-change-before-production";

type JwtPayload = { sub: string; role: string; iat: number; exp: number };

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return atob(padded);
}

function toBytes(value: string) {
  return new TextEncoder().encode(value);
}

export async function verifyJwtEdge(token: string): Promise<JwtPayload | null> {
  try {
    const [header, body, signature] = token.split(".");
    if (!header || !body || !signature) return null;
    const key = await crypto.subtle.importKey("raw", toBytes(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const signatureBytes = Uint8Array.from(decodeBase64Url(signature), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("HMAC", key, signatureBytes, toBytes(`${header}.${body}`));
    if (!valid) return null;
    const payload = JSON.parse(decodeBase64Url(body)) as JwtPayload;
    if (!payload.sub || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
