import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-secret",
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

function toAction(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function toPositiveInt(value: unknown, fieldName: string): number {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ApiError(400, "invalid_payload", `${fieldName} deve essere un intero positivo.`);
  }
  return parsed;
}

function normalizeDateOrToday(value: unknown): string {
  if (typeof value !== "string") return new Date().toISOString().slice(0, 10);
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new ApiError(400, "invalid_payload", "La data deve essere nel formato YYYY-MM-DD.");
  }
  return trimmed;
}

function getAdminSecret(req: Request): string {
  return (req.headers.get("x-admin-secret") ?? "").trim();
}

function ensureAdminSecret(req: Request): void {
  const expectedSecret = (Deno.env.get("ADMIN_SHARED_SECRET") ?? "").trim();
  if (!expectedSecret) {
    throw new ApiError(500, "server_misconfigured", "Config server mancante.");
  }

  const providedSecret = getAdminSecret(req);
  if (!providedSecret || providedSecret !== expectedSecret) {
    throw new ApiError(401, "unauthorized", "Credenziali admin non valide.");
  }
}

function getAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new ApiError(500, "server_misconfigured", "Config server mancante.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

async function getOpenSerata(admin: ReturnType<typeof createClient>) {
  const { data, error } = await admin
    .from("serate")
    .select("*")
    .eq("aperta", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, "query_failed", "Errore durante il caricamento della serata.");
  }

  return data;
}

async function getState(admin: ReturnType<typeof createClient>) {
  const serata = await getOpenSerata(admin);

  if (!serata) {
    return { serata: null, bookings: [] };
  }

  const { data, error } = await admin
    .from("prenotazioni")
    .select("*")
    .eq("cantata", false)
    .eq("serata_id", serata.id)
    .order("created_at", { ascending: true });

  if (error) {
    throw new ApiError(500, "query_failed", "Errore durante il caricamento delle prenotazioni.");
  }

  return { serata, bookings: data ?? [] };
}

async function executeAction(admin: ReturnType<typeof createClient>, action: string, body: Record<string, unknown>) {
  switch (action) {
    case "ping": {
      return { status: 200, data: { ok: true } };
    }

    case "get_state":
    case "state": {
      return { status: 200, data: await getState(admin) };
    }

    case "approve_booking":
    case "approve": {
      const bookingId = toPositiveInt(body.bookingId ?? body.id, "bookingId");
      const { data, error } = await admin
        .from("prenotazioni")
        .update({ approvata: true })
        .eq("id", bookingId)
        .select("id, approvata, cantata")
        .maybeSingle();

      if (error) {
        throw new ApiError(500, "update_failed", "Non sono riuscito ad approvare la prenotazione.");
      }
      if (!data) {
        throw new ApiError(404, "not_found", "Prenotazione non trovata.");
      }

      return { status: 200, data };
    }

    case "delete_booking":
    case "delete": {
      const bookingId = toPositiveInt(body.bookingId ?? body.id, "bookingId");
      const { data, error } = await admin
        .from("prenotazioni")
        .delete()
        .eq("id", bookingId)
        .select("id")
        .maybeSingle();

      if (error) {
        throw new ApiError(500, "delete_failed", "Non sono riuscito a eliminare la prenotazione.");
      }
      if (!data) {
        throw new ApiError(404, "not_found", "Prenotazione non trovata.");
      }

      return { status: 200, data };
    }

    case "mark_done":
    case "done": {
      const bookingId = toPositiveInt(body.bookingId ?? body.id, "bookingId");
      const { data, error } = await admin
        .from("prenotazioni")
        .update({ cantata: true })
        .eq("id", bookingId)
        .select("id, cantata")
        .maybeSingle();

      if (error) {
        throw new ApiError(500, "update_failed", "Non sono riuscito a segnare la prenotazione come completata.");
      }
      if (!data) {
        throw new ApiError(404, "not_found", "Prenotazione non trovata.");
      }

      return { status: 200, data };
    }

    case "open_serata":
    case "open_karaoke": {
      const openSerata = await getOpenSerata(admin);
      if (openSerata) {
        throw new ApiError(409, "already_open", "Esiste già una serata aperta.");
      }

      const date = normalizeDateOrToday(body.data ?? body.date);
      const { data, error } = await admin
        .from("serate")
        .insert({ data: date, aperta: true, voto_aperto: false })
        .select("*")
        .single();

      if (error) {
        throw new ApiError(500, "insert_failed", "Non sono riuscito ad aprire la serata.");
      }

      return { status: 201, data };
    }

    case "close_serata":
    case "close_karaoke": {
      const serataId = body.serataId != null
        ? toPositiveInt(body.serataId, "serataId")
        : (await getOpenSerata(admin))?.id;

      if (!serataId) {
        throw new ApiError(404, "not_found", "Nessuna serata aperta trovata.");
      }

      const { data, error } = await admin
        .from("serate")
        .update({ aperta: false, voto_aperto: false })
        .eq("id", serataId)
        .select("*")
        .maybeSingle();

      if (error) {
        throw new ApiError(500, "update_failed", "Non sono riuscito a chiudere la serata.");
      }
      if (!data) {
        throw new ApiError(404, "not_found", "Serata non trovata.");
      }

      return { status: 200, data };
    }

    case "set_voting":
    case "toggle_voting": {
      const openSerata = await getOpenSerata(admin);
      const currentSerata = body.serataId != null
        ? { id: toPositiveInt(body.serataId, "serataId"), voto_aperto: openSerata?.voto_aperto }
        : openSerata;

      if (!currentSerata?.id) {
        throw new ApiError(404, "not_found", "Nessuna serata aperta trovata.");
      }

      const votoAperto = typeof body.votoAperto === "boolean"
        ? body.votoAperto
        : !Boolean(currentSerata?.voto_aperto);

      const { data, error } = await admin
        .from("serate")
        .update({ voto_aperto: votoAperto })
        .eq("id", currentSerata.id)
        .select("*")
        .maybeSingle();

      if (error) {
        throw new ApiError(500, "update_failed", "Non sono riuscito ad aggiornare lo stato votazioni.");
      }
      if (!data) {
        throw new ApiError(404, "not_found", "Serata non trovata.");
      }

      return { status: 200, data };
    }

    case "cleanup_current_serata":
    case "cleanup_serata": {
      const serataId = body.serataId != null
        ? toPositiveInt(body.serataId, "serataId")
        : (await getOpenSerata(admin))?.id;

      if (!serataId) {
        throw new ApiError(404, "not_found", "Nessuna serata aperta trovata.");
      }

      const { data, error } = await admin
        .from("prenotazioni")
        .delete()
        .eq("serata_id", serataId)
        .select("id");

      if (error) {
        throw new ApiError(500, "delete_failed", "Non sono riuscito a pulire la serata corrente.");
      }

      return {
        status: 200,
        data: {
          serataId,
          deletedBookings: data?.length ?? 0,
        },
      };
    }

    case "cleanup_all_test_data":
    case "cleanup_all": {
      const bookingsResult = await admin
        .from("prenotazioni")
        .delete()
        .gt("id", 0)
        .select("id");

      if (bookingsResult.error) {
        throw new ApiError(500, "delete_failed", "Non sono riuscito a cancellare le prenotazioni.");
      }

      const serateResult = await admin
        .from("serate")
        .delete()
        .gt("id", 0)
        .select("id");

      if (serateResult.error) {
        throw new ApiError(500, "delete_failed", "Prenotazioni pulite, ma non sono riuscito a cancellare le serate.");
      }

      return {
        status: 200,
        data: {
          deletedBookings: bookingsResult.data?.length ?? 0,
          deletedSerate: serateResult.data?.length ?? 0,
        },
      };
    }

    default:
      throw new ApiError(400, "invalid_action", "Azione admin non supportata.");
  }
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
    ensureAdminSecret(req);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "invalid_json", "Body JSON non valido.");
    }

    if (!body || typeof body !== "object") {
      throw new ApiError(400, "invalid_payload", "Body JSON non valido.");
    }

    const payload = body as Record<string, unknown>;
    const action = toAction(payload.action);
    if (!action) {
      throw new ApiError(400, "invalid_payload", "Il campo action è obbligatorio.");
    }

    const admin = getAdminClient();
    const result = await executeAction(admin, action, payload);

    return jsonResponse(req, result.status, {
      success: true,
      data: result.data,
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

    console.error(error);
    return jsonResponse(req, 500, {
      success: false,
      data: null,
      error: { code: "internal_error", message: "Errore interno del server." },
    });
  }
});
