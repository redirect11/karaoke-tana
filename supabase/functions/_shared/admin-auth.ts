import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { compare } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

type AdminCredentialRow = {
  password_hash: string;
};

type AdminTokenPayload = {
  sub: "admin";
  iat: number;
  exp: number;
};

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  const maxLength = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < maxLength; i += 1) {
    const left = i < a.length ? a[i] : 0;
    const right = i < b.length ? b[i] : 0;
    diff |= left ^ right;
  }
  return diff === 0;
}

async function sign(data: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
}

export function getAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Config server mancante.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export async function getActiveAdminPasswordHash(admin: ReturnType<typeof createClient>): Promise<string> {
  const { data, error } = await admin
    .from("admin_credentials")
    .select("password_hash")
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<AdminCredentialRow>();

  if (error) {
    throw new Error("Errore durante il caricamento delle credenziali admin.");
  }
  if (!data?.password_hash || typeof data.password_hash !== "string") {
    throw new Error("Credenziali admin non configurate.");
  }
  return data.password_hash.trim();
}

export async function verifyAdminPassword(password: string, passwordHash: string): Promise<boolean> {
  if (!password || !passwordHash) return false;
  if (!/^\$2[aby]\$\d{2}\$/.test(passwordHash)) return false;
  return await compare(password, passwordHash);
}

export function getAdminTokenSecret(): string {
  const secret = (Deno.env.get("ADMIN_TOKEN_SIGNING_SECRET") ?? "").trim();
  if (!secret) {
    throw new Error("Config server mancante.");
  }
  return secret;
}

export function getAdminTokenTtlSeconds(): number {
  const raw = (Deno.env.get("ADMIN_SESSION_TTL_SECONDS") ?? "").trim();
  if (!raw) return 4 * 60 * 60;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) return 4 * 60 * 60;
  return parsed;
}

export async function createAdminToken(secret: string, ttlSeconds: number): Promise<{ token: string; exp: number }> {
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminTokenPayload = {
    sub: "admin",
    iat: now,
    exp: now + ttlSeconds,
  };

  const headerEncoded = toBase64Url(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payloadEncoded = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signingInput = `${headerEncoded}.${payloadEncoded}`;
  const signatureEncoded = toBase64Url(await sign(signingInput, secret));

  return {
    token: `${signingInput}.${signatureEncoded}`,
    exp: payload.exp,
  };
}

export async function verifyAdminToken(token: string, secret: string): Promise<boolean> {
  const segments = token.split(".");
  if (segments.length !== 3) return false;

  const [headerEncoded, payloadEncoded, signatureEncoded] = segments;
  if (!headerEncoded || !payloadEncoded || !signatureEncoded) return false;

  let payload: AdminTokenPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadEncoded)));
  } catch {
    return false;
  }

  if (!payload || payload.sub !== "admin" || !Number.isInteger(payload.exp)) return false;
  if (payload.exp <= Math.floor(Date.now() / 1000)) return false;

  const signingInput = `${headerEncoded}.${payloadEncoded}`;
  const expectedSignature = await sign(signingInput, secret);
  const providedSignature = fromBase64Url(signatureEncoded);
  return timingSafeEqual(expectedSignature, providedSignature);
}
