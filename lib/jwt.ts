import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET = process.env.AUTH_JWT_SECRET || "tracia-demo-secret-change-before-production";

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

export type JwtPayload = {
  sub: string;
  role: string;
  iat: number;
  exp: number;
};

export function signJwt(payload: Omit<JwtPayload, "iat" | "exp">, ttlSeconds = 60 * 60 * 8) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64url(JSON.stringify({ ...payload, iat: now, exp: now + ttlSeconds }));
  const input = `${header}.${body}`;
  const signature = createHmac("sha256", SECRET).update(input).digest("base64url");
  return `${input}.${signature}`;
}

export function verifyJwt(token: string): JwtPayload | null {
  try {
    const [header, body, signature] = token.split(".");
    if (!header || !body || !signature) return null;
    const expected = createHmac("sha256", SECRET).update(`${header}.${body}`).digest();
    const actual = Buffer.from(signature, "base64url");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as JwtPayload;
    if (!payload.sub || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
