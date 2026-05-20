import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  createAdminToken,
  getActiveAdminPasswordHash,
  getAdminClient,
  getAdminTokenSecret,
  getAdminTokenTtlSeconds,
  verifyAdminPassword,
} from "../_shared/admin-auth.ts";

type ApiEnvelope = {
  success: boolean;
  data: unknown;
  error: { code: string; message: string } | null;
};

class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function parseAllowedOrigins(): string[] {
  const raw = Deno.env.get("ALLOWED_ORIGINS") ?? "*";
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function getCorsHeaders(origin: string | null): HeadersInit {
  const allowedOrigins = parseAllowedOrigins();
  const allowAny = allowedOrigins.includes("*");
  const isAllowed = Boolean(origin) && allowedOrigins.includes(origin!);
  const allowOrigin = allowAny ? "*" : (isAllowed ? origin! : "null");

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}

function jsonResponse(req: Request, status: number, payload: ApiEnvelope): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: getCorsHeaders(req.headers.get("origin")),
  });
}

function parsePassword(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    throw new ApiError(400, "invalid_payload", "Body JSON non valido.");
  }

  const password = typeof (payload as Record<string, unknown>).password === "string"
    ? (payload as Record<string, unknown>).password.trim()
    : "";

  if (!password) {
    throw new ApiError(400, "invalid_payload", "La password è obbligatoria.");
  }

  if (password.length > 256) {
    throw new ApiError(400, "invalid_payload", "Password non valida.");
  }

  return password;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(req.headers.get("origin")) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, 405, {
      success: false,
      data: null,
      error: { code: "method_not_allowed", message: "Metodo non supportato." },
    });
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "invalid_json", "Body JSON non valido.");
    }

    const password = parsePassword(body);
    const admin = getAdminClient();
    const passwordHash = await getActiveAdminPasswordHash(admin);
    const isValid = await verifyAdminPassword(password, passwordHash);

    if (!isValid) {
      throw new ApiError(401, "unauthorized", "Credenziali non valide.");
    }

    const tokenSecret = getAdminTokenSecret();
    const ttlSeconds = getAdminTokenTtlSeconds();
    const token = await createAdminToken(tokenSecret, ttlSeconds);

    return jsonResponse(req, 200, {
      success: true,
      data: {
        token: token.token,
        expiresIn: ttlSeconds,
        expiresAt: new Date(token.exp * 1000).toISOString(),
      },
      error: null,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonResponse(req, error.status, {
        success: false,
        data: null,
        error: { code: error.code, message: error.message },
      });
    }

    const message = error instanceof Error ? error.message : "Errore interno del server.";
    const code = message === "Credenziali admin non configurate." || message === "Config server mancante."
      ? "server_misconfigured"
      : "internal_error";
    const status = 500;

    console.error(error);
    return jsonResponse(req, status, {
      success: false,
      data: null,
      error: { code, message: code === "server_misconfigured" ? message : "Errore interno del server." },
    });
  }
});
