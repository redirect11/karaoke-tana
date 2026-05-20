import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type BookingPayload = {
  nome: string;
  canzone: string;
  artista: string;
  serata_id?: number | null;
};

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

function jsonResponse(
  req: Request,
  status: number,
  payload: { success: boolean; data: unknown; error: { code: string; message: string } | null },
): Response {
  const origin = req.headers.get("origin");
  return new Response(JSON.stringify(payload), {
    status,
    headers: getCorsHeaders(origin),
  });
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function validatePayload(payload: unknown): { ok: true; data: BookingPayload } | { ok: false; message: string } {
  if (!payload || typeof payload !== "object") {
    return { ok: false, message: "Body JSON non valido." };
  }

  const body = payload as Record<string, unknown>;
  const nome = normalizeText(body.nome);
  const canzone = normalizeText(body.canzone);
  const artista = normalizeText(body.artista);
  const serata_id = body.serata_id;
  let parsedSerataId: number | null = null;

  if (!nome || !canzone || !artista) {
    return { ok: false, message: "I campi nome, canzone e artista sono obbligatori." };
  }

  if (nome.length > 80 || canzone.length > 140 || artista.length > 140) {
    return { ok: false, message: "Uno o più campi superano la lunghezza massima consentita." };
  }

  if (serata_id !== undefined && serata_id !== null && serata_id !== "") {
    const normalizedSerataId = typeof serata_id === "number"
      ? serata_id
      : Number(String(serata_id).trim());

    if (!Number.isInteger(normalizedSerataId) || normalizedSerataId <= 0) {
      return { ok: false, message: "serata_id deve essere un intero positivo oppure null." };
    }

    parsedSerataId = normalizedSerataId;
  }

  return {
    ok: true,
    data: {
      nome,
      canzone,
      artista,
      serata_id: parsedSerataId,
    },
  };
}

async function validateUserToken(req: Request): Promise<{ ok: true } | { ok: false }> {
  const requireAuth = (Deno.env.get("REQUIRE_AUTH") ?? "false").toLowerCase() === "true";
  if (!requireAuth) return { ok: true };

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) return { ok: false };

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return { ok: false };

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return { ok: false };

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await authClient.auth.getUser();
  if (error || !data.user) return { ok: false };
  return { ok: true };
}

async function getOpenSerata(admin: ReturnType<typeof createClient>) {
  const { data, error } = await admin
    .from("serate")
    .select("id")
    .eq("aperta", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { ok: false as const, error };
  }

  return { ok: true as const, data };
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

  const authCheck = await validateUserToken(req);
  if (!authCheck.ok) {
    return jsonResponse(req, 401, {
      success: false,
      data: null,
      error: { code: "unauthorized", message: "Autenticazione non valida." },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, 400, {
      success: false,
      data: null,
      error: { code: "invalid_json", message: "Body JSON non valido." },
    });
  }

  const validated = validatePayload(body);
  if (!validated.ok) {
    return jsonResponse(req, 400, {
      success: false,
      data: null,
      error: { code: "invalid_payload", message: validated.message },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(req, 500, {
      success: false,
      data: null,
      error: { code: "server_misconfigured", message: "Config server mancante." },
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const insertPayload: Record<string, unknown> = {
    nome: validated.data.nome,
    canzone: validated.data.canzone,
    artista: validated.data.artista,
    approvata: false,
  };

  const openSerata = await getOpenSerata(admin);
  if (!openSerata.ok) {
    return jsonResponse(req, 500, {
      success: false,
      data: null,
      error: { code: "query_failed", message: "Errore durante il caricamento della serata." },
    });
  }

  if (!openSerata.data) {
    return jsonResponse(req, 409, {
      success: false,
      data: null,
      error: { code: "bookings_closed", message: "Le prenotazioni sono chiuse: nessuna serata aperta." },
    });
  }

  const openSerataId = Number(openSerata.data.id);
  if (!Number.isInteger(openSerataId) || openSerataId <= 0) {
    return jsonResponse(req, 500, {
      success: false,
      data: null,
      error: { code: "query_failed", message: "Errore durante il caricamento della serata." },
    });
  }

  if (
    validated.data.serata_id !== null
    && validated.data.serata_id !== undefined
    && validated.data.serata_id !== openSerataId
  ) {
    return jsonResponse(req, 409, {
      success: false,
      data: null,
      error: { code: "invalid_serata_id", message: "La serata selezionata non è più aperta. Aggiorna la pagina e riprova." },
    });
  }

  insertPayload.serata_id = openSerataId;

  const { data, error } = await admin
    .from("prenotazioni")
    .insert(insertPayload)
    .select("id, created_at")
    .single();

  if (error) {
    return jsonResponse(req, 500, {
      success: false,
      data: null,
      error: { code: "insert_failed", message: "Errore durante il salvataggio della prenotazione." },
    });
  }

  return jsonResponse(req, 201, {
    success: true,
    data,
    error: null,
  });
});
