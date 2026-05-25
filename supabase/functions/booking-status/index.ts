import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

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

function parseBookingId(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const bookingId = (payload as Record<string, unknown>).bookingId;
  const normalized = typeof bookingId === "number"
    ? bookingId
    : Number.parseInt(String(bookingId ?? "").trim(), 10);
  if (!Number.isInteger(normalized) || normalized <= 0) return null;
  return normalized;
}

function getPendingExpiryMinutes(): number {
  const raw = Deno.env.get("BOOKING_PENDING_EXPIRY_MIN") ?? "30";
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return 30;
  return Math.min(parsed, 60);
}

function computePendingExpiryIso(createdAt: string | null): string | null {
  if (!createdAt) return null;
  const createdAtMs = Date.parse(createdAt);
  if (!Number.isFinite(createdAtMs)) return null;
  return new Date(createdAtMs + getPendingExpiryMinutes() * 60 * 1000).toISOString();
}

async function computeBookingNumber(
  admin: ReturnType<typeof createClient>,
  serataId: number,
  bookingId: number,
): Promise<{ ok: true; value: number } | { ok: false; error: unknown }> {
  const { count, error } = await admin
    .from("prenotazioni")
    .select("id", { count: "exact", head: true })
    .eq("serata_id", serataId)
    .lte("id", bookingId);

  if (error) return { ok: false, error };
  return { ok: true, value: count ?? 0 };
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

  const bookingId = parseBookingId(body);
  if (!bookingId) {
    return jsonResponse(req, 400, {
      success: false,
      data: null,
      error: { code: "invalid_payload", message: "bookingId deve essere un intero positivo." },
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
  const { data, error } = await admin
    .from("prenotazioni")
    .select("id, nome, canzone, artista, created_at, approvata, cantata, serata_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    return jsonResponse(req, 500, {
      success: false,
      data: null,
      error: { code: "query_failed", message: "Errore durante il caricamento della prenotazione." },
    });
  }

  if (!data || data.cantata) {
    return jsonResponse(req, 200, {
      success: true,
      data: { exists: false, pending: false, approved: false, expired: false },
      error: null,
    });
  }

  if (data.approvata) {
    const serataIdNum = Number(data.serata_id);
    let bookingNumber = null;
    if (Number.isInteger(serataIdNum) && serataIdNum > 0) {
      const bookingNumberResult = await computeBookingNumber(admin, serataIdNum, bookingId);
      if (!bookingNumberResult.ok) {
        return jsonResponse(req, 500, {
          success: false,
          data: null,
          error: { code: "query_failed", message: "Errore durante il calcolo del numero prenotazione." },
        });
      }
      bookingNumber = bookingNumberResult.value;
    }
    return jsonResponse(req, 200, {
      success: true,
      data: {
        exists: true,
        pending: true,
        approved: true,
        expired: false,
        id: data.id,
        nome: data.nome,
        canzone: data.canzone,
        artista: data.artista,
        serata_id: data.serata_id,
        booking_number: bookingNumber,
        created_at: data.created_at,
        expires_at: null,
      },
      error: null,
    });
  }

  const expiresAt = computePendingExpiryIso(data.created_at);
  if (expiresAt && Date.now() >= Date.parse(expiresAt)) {
    const { error: deleteError } = await admin
      .from("prenotazioni")
      .delete()
      .eq("id", bookingId)
      .eq("approvata", false)
      .eq("cantata", false);
    if (deleteError) {
      return jsonResponse(req, 500, {
        success: false,
        data: null,
        error: { code: "delete_failed", message: "Errore durante la scadenza automatica della prenotazione." },
      });
    }
    return jsonResponse(req, 200, {
      success: true,
      data: { exists: false, pending: false, approved: false, expired: true },
      error: null,
    });
  }

  const serataIdNum = Number(data.serata_id);
  let bookingNumber = null;
  if (Number.isInteger(serataIdNum) && serataIdNum > 0) {
    const bookingNumberResult = await computeBookingNumber(admin, serataIdNum, bookingId);
    if (!bookingNumberResult.ok) {
      return jsonResponse(req, 500, {
        success: false,
        data: null,
        error: { code: "query_failed", message: "Errore durante il calcolo del numero prenotazione." },
      });
    }
    bookingNumber = bookingNumberResult.value;
  }

  return jsonResponse(req, 200, {
    success: true,
    data: {
      exists: true,
      pending: true,
      approved: false,
      expired: false,
      id: data.id,
      nome: data.nome,
      canzone: data.canzone,
      artista: data.artista,
      serata_id: data.serata_id,
      booking_number: bookingNumber,
      created_at: data.created_at,
      expires_at: expiresAt,
    },
    error: null,
  });
});
