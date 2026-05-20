import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type AdminCredentialRow = {
  password_hash: string;
  password_salt: string | null;
  password_iterations: number | null;
  password_hash_algo: string | null;
};

type AdminTokenPayload = {
  sub: "admin";
  iat: number;
  exp: number;
};

type AdminPasswordMaterial = {
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
  passwordHashAlgo: string;
};

export class AdminAuthConfigError extends Error {}

const SUPPORTED_PASSWORD_HASH_ALGO = "pbkdf2-sha256";

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
    .padEnd(value.length + (4 - value.length % 4) % 4, "=");
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
    throw new AdminAuthConfigError("Config server mancante.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export async function getActiveAdminPasswordHash(admin: ReturnType<typeof createClient>): Promise<AdminPasswordMaterial> {
  const { data, error } = await admin
    .from("admin_credentials")
    .select("password_hash, password_salt, password_iterations, password_hash_algo")
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<AdminCredentialRow>();

  if (error) {
    throw new AdminAuthConfigError("Errore durante il caricamento delle credenziali admin.");
  }
  if (
    !data?.password_hash || typeof data.password_hash !== "string" ||
    !data.password_salt || typeof data.password_salt !== "string" ||
    !Number.isInteger(data.password_iterations) || (data.password_iterations ?? 0) <= 0
  ) {
    throw new AdminAuthConfigError("Credenziali admin non configurate.");
  }

  const passwordHash = data.password_hash.trim();
  const passwordSalt = data.password_salt.trim();
  const passwordHashAlgo = (data.password_hash_algo ?? SUPPORTED_PASSWORD_HASH_ALGO).trim().toLowerCase();
  if (!passwordHash || !passwordSalt || !passwordHashAlgo) {
    throw new AdminAuthConfigError("Credenziali admin non configurate.");
  }

  return {
    passwordHash,
    passwordSalt,
    passwordIterations: data.password_iterations,
    passwordHashAlgo,
  };
}

function fromBase64(value: string): Uint8Array {
  const base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(value.length + (4 - value.length % 4) % 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function derivePasswordHash(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations,
    },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function verifyAdminPassword(password: string, material: AdminPasswordMaterial): Promise<boolean> {
  if (!password) return false;
  if (material.passwordHashAlgo !== SUPPORTED_PASSWORD_HASH_ALGO) {
    throw new AdminAuthConfigError("Algoritmo hash password admin non supportato.");
  }

  let expectedHash: Uint8Array;
  let salt: Uint8Array;
  try {
    expectedHash = fromBase64(material.passwordHash);
    salt = fromBase64(material.passwordSalt);
  } catch {
    throw new AdminAuthConfigError("Credenziali admin non configurate.");
  }
  if (!expectedHash.length || !salt.length) {
    throw new AdminAuthConfigError("Credenziali admin non configurate.");
  }

  const candidateHash = await derivePasswordHash(password, salt, material.passwordIterations);
  return timingSafeEqual(candidateHash, expectedHash);
}

export function getAdminTokenSecret(): string {
  const secret = (Deno.env.get("ADMIN_TOKEN_SIGNING_SECRET") ?? "").trim();
  if (!secret) {
    throw new AdminAuthConfigError("Config server mancante.");
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
