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

function normalizeBookingText(value: unknown, fieldName: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new ApiError(400, "invalid_payload", `${fieldName} deve essere una stringa.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ApiError(400, "invalid_payload", `${fieldName} è obbligatorio.`);
  }
  if (trimmed.length > maxLength) {
    throw new ApiError(400, "invalid_payload", `${fieldName} supera la lunghezza massima consentita.`);
  }
  return trimmed;
}

function parseBookingUpdatePayload(body: Record<string, unknown>) {
  const updates: Record<string, string> = {};
  const hasOwn = (field: string) => Object.prototype.hasOwnProperty.call(body, field);

  if (hasOwn("nome")) {
    updates.nome = normalizeBookingText(body.nome, "nome", 80);
  }
  if (hasOwn("canzone")) {
    updates.canzone = normalizeBookingText(body.canzone, "canzone", 140);
  }
  if (hasOwn("artista")) {
    updates.artista = normalizeBookingText(body.artista, "artista", 140);
  }

  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, "invalid_payload", "Specifica almeno un campo da aggiornare: nome, canzone o artista.");
  }

  return updates;
}

function normalizeDateOrToday(value: unknown): string {
  if (typeof value !== "string") return new Date().toISOString().slice(0, 10);
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new ApiError(400, "invalid_payload", "La data deve essere nel formato YYYY-MM-DD.");
  }
  return trimmed;
}

function normalizeOptionalDate(value: unknown, fieldName: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new ApiError(400, "invalid_payload", `${fieldName} deve essere una data YYYY-MM-DD o null.`);
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new ApiError(400, "invalid_payload", `${fieldName} deve essere nel formato YYYY-MM-DD.`);
  }
  return trimmed;
}

function toIsoDateFromTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

function getArchiveDate(serata: Record<string, unknown>): string | null {
  const fromCreatedAt = toIsoDateFromTimestamp(serata.created_at);
  if (fromCreatedAt) return fromCreatedAt;
  const fromData = typeof serata.data === "string" ? serata.data : null;
  if (fromData && /^\d{4}-\d{2}-\d{2}$/.test(fromData)) return fromData;
  return null;
}

function createAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new ApiError(500, "server_misconfigured", "Config server mancante.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function ensureAdminAuth(req: Request): Promise<void> {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    throw new ApiError(401, "unauthorized", "Credenziali admin non valide.");
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    throw new ApiError(401, "unauthorized", "Credenziali admin non valide.");
  }

  const client = createAdminClient();

  // Verify the Supabase Auth JWT and retrieve the authenticated user.
  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user) {
    throw new ApiError(401, "unauthorized", "Credenziali admin non valide.");
  }

  // Check the user is in the admin allowlist.
  const { data: adminRow, error: adminError } = await client
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminError) {
    throw new ApiError(500, "server_error", "Errore durante la verifica admin.");
  }

  if (!adminRow) {
    throw new ApiError(403, "forbidden", "Accesso riservato agli amministratori.");
  }
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

async function getSerataById(admin: ReturnType<typeof createClient>, serataId: number) {
  const { data, error } = await admin
    .from("serate")
    .select("*")
    .eq("id", serataId)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, "query_failed", "Errore durante il caricamento della serata.");
  }

  return data;
}

function computeScoreMap(votes: Array<{ prenotazione_id: number; voto: number }>) {
  const byBooking = new Map<number, { total: number; count: number }>();
  for (const vote of votes) {
    const bookingId = Number(vote.prenotazione_id);
    if (!Number.isInteger(bookingId) || bookingId <= 0) continue;
    const value = Number(vote.voto);
    if (!Number.isFinite(value)) continue;
    const current = byBooking.get(bookingId) ?? { total: 0, count: 0 };
    current.total += value;
    current.count += 1;
    byBooking.set(bookingId, current);
  }
  return byBooking;
}

function buildRanking(bookings: Array<Record<string, unknown>>, scoreMap: Map<number, { total: number; count: number }>) {
  return bookings
    .map((booking) => {
      const bookingId = Number(booking.id);
      const score = scoreMap.get(bookingId) ?? { total: 0, count: 0 };
      const scoreAverage = score.count > 0 ? score.total / score.count : 0;
      return {
        ...booking,
        score_total: score.total,
        score_count: score.count,
        score_average_raw: scoreAverage,
        score_average: Number(scoreAverage.toFixed(2)),
      };
    })
    .sort((a, b) => {
      if (b.score_total !== a.score_total) return b.score_total - a.score_total;
      if (b.score_average_raw !== a.score_average_raw) return b.score_average_raw - a.score_average_raw;
      if (b.score_count !== a.score_count) return b.score_count - a.score_count;
      return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
    })
    .map((booking) => {
      const { score_average_raw: _scoreAverageRaw, ...publicBooking } = booking;
      return publicBooking;
    });
}

async function getBookingScores(
  admin: ReturnType<typeof createClient>,
  bookings: Array<Record<string, unknown>>,
) {
  const bookingIds = bookings
    .map((booking) => Number(booking.id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (bookingIds.length === 0) {
    return new Map<number, { total: number; count: number }>();
  }

  const { data, error } = await admin
    .from("voti")
    .select("prenotazione_id, voto")
    .in("prenotazione_id", bookingIds);

  if (error) {
    throw new ApiError(500, "query_failed", "Errore durante il caricamento dei voti.");
  }

  return computeScoreMap((data ?? []) as Array<{ prenotazione_id: number; voto: number }>);
}

async function ensureSerataAllowsMutations(
  admin: ReturnType<typeof createClient>,
  serataId: number,
) {
  const serata = await getSerataById(admin, serataId);
  if (!serata) {
    throw new ApiError(404, "not_found", "Serata non trovata.");
  }
  if (serata.vincitore_decretato) {
    throw new ApiError(409, "winner_already_decreed", "Vincitore già decretato: puoi solo chiudere il karaoke.");
  }
  return serata;
}

async function getState(admin: ReturnType<typeof createClient>) {
  const serata = await getOpenSerata(admin);
  const settings = await getPublicSettings(admin);

  if (!serata) {
    return { serata: null, bookings: [], top5: [], settings };
  }

  const { data, error } = await admin
    .from("prenotazioni")
    .select("*")
    .eq("serata_id", serata.id)
    .order("created_at", { ascending: true });

  if (error) {
    throw new ApiError(500, "query_failed", "Errore durante il caricamento delle prenotazioni.");
  }

  const bookings = (data ?? []) as Array<Record<string, unknown>>;
  const scoreMap = await getBookingScores(admin, bookings);
  const bookingsWithScores = bookings.map((booking) => {
    const bookingId = Number(booking.id);
    const score = scoreMap.get(bookingId) ?? { total: 0, count: 0 };
    const scoreAverage = score.count > 0 ? score.total / score.count : 0;
    return {
      ...booking,
      score_total: score.total,
      score_count: score.count,
      score_average: Number(scoreAverage.toFixed(2)),
    };
  });
  const approved = bookingsWithScores.filter((booking) => Boolean(booking.approvata));
  const top5 = buildRanking(approved, scoreMap).slice(0, 5);

  return { serata, bookings: bookingsWithScores, top5, settings };
}

async function getPublicSettings(admin: ReturnType<typeof createClient>) {
  const { data, error } = await admin
    .from("impostazioni_pubbliche")
    .select("id, archivio_pubblico_abilitato, prossima_serata_data")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, "query_failed", "Errore durante il caricamento delle impostazioni pubbliche.");
  }

  if (data) {
    return data;
  }

  const { data: inserted, error: insertError } = await admin
    .from("impostazioni_pubbliche")
    .insert({ id: 1, archivio_pubblico_abilitato: false, prossima_serata_data: null })
    .select("id, archivio_pubblico_abilitato, prossima_serata_data")
    .maybeSingle();

  if (insertError || !inserted) {
    throw new ApiError(500, "insert_failed", "Non sono riuscito a inizializzare le impostazioni pubbliche.");
  }

  return inserted;
}

async function updatePublicSettings(
  admin: ReturnType<typeof createClient>,
  updates: { archivio_pubblico_abilitato?: boolean; prossima_serata_data?: string | null },
) {
  await getPublicSettings(admin);

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof updates.archivio_pubblico_abilitato === "boolean") {
    payload.archivio_pubblico_abilitato = updates.archivio_pubblico_abilitato;
  }
  if (Object.prototype.hasOwnProperty.call(updates, "prossima_serata_data")) {
    payload.prossima_serata_data = updates.prossima_serata_data ?? null;
  }

  const { data, error } = await admin
    .from("impostazioni_pubbliche")
    .update(payload)
    .eq("id", 1)
    .select("id, archivio_pubblico_abilitato, prossima_serata_data")
    .maybeSingle();

  if (error || !data) {
    throw new ApiError(500, "update_failed", "Non sono riuscito ad aggiornare le impostazioni pubbliche.");
  }

  return data;
}

async function getArchive(admin: ReturnType<typeof createClient>, serataId?: number) {
  const { data: editions, error: editionsError } = await admin
    .from("serate")
    .select("id, data, created_at, voto_aperto, vincitore_decretato, vincitore_prenotazione_id")
    .eq("aperta", false)
    .order("data", { ascending: false })
    .order("created_at", { ascending: false });

  if (editionsError) {
    throw new ApiError(500, "query_failed", "Errore durante il caricamento dell'archivio.");
  }

  const normalizedEditions = (editions ?? []).map((edition) => ({
    ...edition,
    archive_date: getArchiveDate(edition as Record<string, unknown>),
  }));

  const selectedSerataId = serataId ?? Number(normalizedEditions[0]?.id ?? 0);
  if (!Number.isInteger(selectedSerataId) || selectedSerataId <= 0) {
    return { editions: normalizedEditions, detail: null };
  }

  const detailSerata = await getSerataById(admin, selectedSerataId);
  if (!detailSerata || detailSerata.aperta) {
    throw new ApiError(404, "not_found", "Edizione archivio non trovata.");
  }

  const { data: serataBookings, error: bookingsError } = await admin
    .from("prenotazioni")
    .select("*")
    .eq("serata_id", selectedSerataId)
    .order("created_at", { ascending: true });

  if (bookingsError) {
    throw new ApiError(500, "query_failed", "Errore durante il caricamento delle prenotazioni archivio.");
  }

  const allBookings = (serataBookings ?? []) as Array<Record<string, unknown>>;
  const songsList: Array<Record<string, unknown>> = [];
  const approvedForRanking: Array<Record<string, unknown>> = [];
  const scoredBookings: Array<Record<string, unknown>> = [];
  for (const booking of allBookings) {
    const isPerformed = Boolean(booking.cantata);
    const isApproved = Boolean(booking.approvata);
    if (isPerformed) songsList.push(booking);
    if (isApproved) approvedForRanking.push(booking);
    if (isPerformed || isApproved) scoredBookings.push(booking);
  }
  const scoreMap = await getBookingScores(admin, scoredBookings);
  const songsWithScores = songsList.map((song) => {
    const bookingId = Number(song.id);
    const score = scoreMap.get(bookingId) ?? { total: 0, count: 0 };
    const scoreAverage = score.count > 0 ? score.total / score.count : 0;
    return {
      ...song,
      score_total: score.total,
      score_count: score.count,
      score_average: Number(scoreAverage.toFixed(2)),
    };
  });

  const ranked = buildRanking(approvedForRanking, scoreMap);
  const top5 = ranked.filter((song) => Number(song.score_count) > 0).slice(0, 5);
  const detail = {
    serata: {
      ...detailSerata,
      archive_date: getArchiveDate(detailSerata as Record<string, unknown>),
    },
    songs: songsWithScores,
    top5,
    hasVoting: top5.length > 0,
  };

  return { editions: normalizedEditions, detail };
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

    case "get_public_settings": {
      return { status: 200, data: await getPublicSettings(admin) };
    }

    case "set_public_settings": {
      const updates: { archivio_pubblico_abilitato?: boolean; prossima_serata_data?: string | null } = {};
      if (typeof body.archivioPubblicoAbilitato === "boolean") {
        updates.archivio_pubblico_abilitato = body.archivioPubblicoAbilitato;
      }
      if (Object.prototype.hasOwnProperty.call(body, "prossimaSerataData")) {
        updates.prossima_serata_data = normalizeOptionalDate(body.prossimaSerataData, "prossimaSerataData");
      }
      if (
        typeof updates.archivio_pubblico_abilitato !== "boolean"
        && !Object.prototype.hasOwnProperty.call(updates, "prossima_serata_data")
      ) {
        throw new ApiError(400, "invalid_payload", "Specifica almeno archivioPubblicoAbilitato o prossimaSerataData.");
      }
      return { status: 200, data: await updatePublicSettings(admin, updates) };
    }

    case "get_archive": {
      const serataId = body.serataId != null
        ? toPositiveInt(body.serataId, "serataId")
        : undefined;
      return { status: 200, data: await getArchive(admin, serataId) };
    }

    case "approve_booking":
    case "approve": {
      const bookingId = toPositiveInt(body.bookingId ?? body.id, "bookingId");
      const { data: bookingToApprove, error: bookingLoadError } = await admin
        .from("prenotazioni")
        .select("id, serata_id")
        .eq("id", bookingId)
        .maybeSingle();

      if (bookingLoadError) {
        throw new ApiError(500, "query_failed", "Errore durante il caricamento della prenotazione.");
      }
      if (!bookingToApprove) {
        throw new ApiError(404, "not_found", "Prenotazione non trovata.");
      }
      const approveSerataId = Number(bookingToApprove.serata_id);
      if (Number.isInteger(approveSerataId) && approveSerataId > 0) {
        await ensureSerataAllowsMutations(admin, approveSerataId);
      }

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

    case "update_booking":
    case "update": {
      const bookingId = toPositiveInt(body.bookingId ?? body.id, "bookingId");
      const updates = parseBookingUpdatePayload(body);

      const { data: bookingToUpdate, error: bookingLoadError } = await admin
        .from("prenotazioni")
        .select("id, serata_id")
        .eq("id", bookingId)
        .maybeSingle();

      if (bookingLoadError) {
        throw new ApiError(500, "query_failed", "Errore durante il caricamento della prenotazione.");
      }
      if (!bookingToUpdate) {
        throw new ApiError(404, "not_found", "Prenotazione non trovata.");
      }
      const updateSerataId = Number(bookingToUpdate.serata_id);
      if (Number.isInteger(updateSerataId) && updateSerataId > 0) {
        await ensureSerataAllowsMutations(admin, updateSerataId);
      }

      const { data, error } = await admin
        .from("prenotazioni")
        .update(updates)
        .eq("id", bookingId)
        .select("id, nome, canzone, artista, approvata, cantata")
        .maybeSingle();

      if (error) {
        throw new ApiError(500, "update_failed", "Non sono riuscito a modificare la prenotazione.");
      }
      if (!data) {
        throw new ApiError(404, "not_found", "Prenotazione non trovata.");
      }

      return { status: 200, data };
    }

    case "delete_booking":
    case "delete": {
      const bookingId = toPositiveInt(body.bookingId ?? body.id, "bookingId");
      const { data: bookingToDelete, error: bookingLoadError } = await admin
        .from("prenotazioni")
        .select("id, serata_id")
        .eq("id", bookingId)
        .maybeSingle();

      if (bookingLoadError) {
        throw new ApiError(500, "query_failed", "Errore durante il caricamento della prenotazione.");
      }
      if (!bookingToDelete) {
        throw new ApiError(404, "not_found", "Prenotazione non trovata.");
      }
      const deleteSerataId = Number(bookingToDelete.serata_id);
      if (Number.isInteger(deleteSerataId) && deleteSerataId > 0) {
        await ensureSerataAllowsMutations(admin, deleteSerataId);
      }

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
      const { data: bookingToComplete, error: bookingLoadError } = await admin
        .from("prenotazioni")
        .select("id, serata_id")
        .eq("id", bookingId)
        .maybeSingle();

      if (bookingLoadError) {
        throw new ApiError(500, "query_failed", "Errore durante il caricamento della prenotazione.");
      }
      if (!bookingToComplete) {
        throw new ApiError(404, "not_found", "Prenotazione non trovata.");
      }
      const completeSerataId = Number(bookingToComplete.serata_id);
      if (Number.isInteger(completeSerataId) && completeSerataId > 0) {
        await ensureSerataAllowsMutations(admin, completeSerataId);
      }

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

      const date = normalizeDateOrToday(body.date);
      const { data, error } = await admin
        .from("serate")
        .insert({
          data: date,
          aperta: true,
          voto_aperto: false,
          mostra_voti_totali: false,
          notifiche_telegram_abilitate: true,
          notifiche_browser_abilitate: true,
          vincitore_decretato: false,
          vincitore_prenotazione_id: null,
        })
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
        .update({ aperta: false, voto_aperto: false, mostra_voti_totali: false })
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
      const currentSerata = body.serataId != null
        ? await getSerataById(admin, toPositiveInt(body.serataId, "serataId"))
        : await getOpenSerata(admin);

      if (!currentSerata?.id) {
        throw new ApiError(404, "not_found", "Nessuna serata aperta trovata.");
      }
      if (currentSerata.vincitore_decretato) {
        throw new ApiError(409, "winner_already_decreed", "Vincitore già decretato: non puoi riaprire le votazioni.");
      }

      const votoAperto = typeof body.votoAperto === "boolean"
        ? body.votoAperto
        : !currentSerata?.voto_aperto;

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

    case "set_show_vote_totals":
    case "toggle_show_vote_totals": {
      const currentSerata = body.serataId != null
        ? await getSerataById(admin, toPositiveInt(body.serataId, "serataId"))
        : await getOpenSerata(admin);

      if (!currentSerata?.id) {
        throw new ApiError(404, "not_found", "Nessuna serata aperta trovata.");
      }

      const showVoteTotals = typeof body.mostraVotiTotali === "boolean"
        ? body.mostraVotiTotali
        : !Boolean(currentSerata.mostra_voti_totali);

      const { data, error } = await admin
        .from("serate")
        .update({ mostra_voti_totali: showVoteTotals })
        .eq("id", currentSerata.id)
        .select("*")
        .maybeSingle();

      if (error) {
        throw new ApiError(500, "update_failed", "Non sono riuscito ad aggiornare la visibilità dei voti.");
      }
      if (!data) {
        throw new ApiError(404, "not_found", "Serata non trovata.");
      }

      return { status: 200, data };
    }

    case "set_browser_notifications":
    case "toggle_browser_notifications": {
      const currentSerata = body.serataId != null
        ? await getSerataById(admin, toPositiveInt(body.serataId, "serataId"))
        : await getOpenSerata(admin);

      if (!currentSerata?.id) {
        throw new ApiError(404, "not_found", "Nessuna serata aperta trovata.");
      }

      const browserNotificationsEnabled = typeof body.notificheBrowserAbilitate === "boolean"
        ? body.notificheBrowserAbilitate
        : !Boolean(currentSerata.notifiche_browser_abilitate);

      const { data, error } = await admin
        .from("serate")
        .update({ notifiche_browser_abilitate: browserNotificationsEnabled })
        .eq("id", currentSerata.id)
        .select("*")
        .maybeSingle();

      if (error) {
        throw new ApiError(500, "update_failed", "Non sono riuscito ad aggiornare le notifiche browser.");
      }
      if (!data) {
        throw new ApiError(404, "not_found", "Serata non trovata.");
      }

      return { status: 200, data };
    }

    case "set_telegram_notifications":
    case "toggle_telegram_notifications": {
      const currentSerata = body.serataId != null
        ? await getSerataById(admin, toPositiveInt(body.serataId, "serataId"))
        : await getOpenSerata(admin);

      if (!currentSerata?.id) {
        throw new ApiError(404, "not_found", "Nessuna serata aperta trovata.");
      }

      const telegramNotificationsEnabled = typeof body.notificheTelegramAbilitate === "boolean"
        ? body.notificheTelegramAbilitate
        : !Boolean(currentSerata.notifiche_telegram_abilitate);

      const { data, error } = await admin
        .from("serate")
        .update({ notifiche_telegram_abilitate: telegramNotificationsEnabled })
        .eq("id", currentSerata.id)
        .select("*")
        .maybeSingle();

      if (error) {
        throw new ApiError(500, "update_failed", "Non sono riuscito ad aggiornare le notifiche Telegram.");
      }
      if (!data) {
        throw new ApiError(404, "not_found", "Serata non trovata.");
      }

      return { status: 200, data };
    }

    case "decree_winner":
    case "decreta_vincitore": {
      const currentSerata = body.serataId != null
        ? await getSerataById(admin, toPositiveInt(body.serataId, "serataId"))
        : await getOpenSerata(admin);

      if (!currentSerata?.id) {
        throw new ApiError(404, "not_found", "Nessuna serata aperta trovata.");
      }
      if (currentSerata.vincitore_decretato) {
        throw new ApiError(409, "winner_already_decreed", "Il vincitore è già stato decretato.");
      }

      const { data: serataBookings, error: bookingsError } = await admin
        .from("prenotazioni")
        .select("*")
        .eq("serata_id", currentSerata.id)
        .order("created_at", { ascending: true });

      if (bookingsError) {
        throw new ApiError(500, "query_failed", "Errore durante il caricamento delle prenotazioni.");
      }

      const allBookings = (serataBookings ?? []) as Array<Record<string, unknown>>;
      const approvedBookings = allBookings.filter((booking) => Boolean(booking.approvata));
      if (approvedBookings.length === 0) {
        throw new ApiError(409, "no_approved_bookings", "Servono prenotazioni approvate per decretare il vincitore.");
      }

      const scoreMap = await getBookingScores(admin, allBookings);
      const top5 = buildRanking(approvedBookings, scoreMap).slice(0, 5);
      if (top5.length === 0) {
        throw new ApiError(409, "no_ranking_available", "Impossibile calcolare la classifica finale.");
      }

      const winnerBookingId = Number(top5[0].id);
      if (!Number.isInteger(winnerBookingId) || winnerBookingId <= 0) {
        throw new ApiError(500, "invalid_winner", "Impossibile identificare il vincitore.");
      }

      const { data: updatedSerata, error: updateError } = await admin
        .from("serate")
        .update({
          vincitore_decretato: true,
          vincitore_prenotazione_id: winnerBookingId,
          voto_aperto: false,
          mostra_voti_totali: true,
        })
        .eq("id", currentSerata.id)
        .select("*")
        .maybeSingle();

      if (updateError) {
        throw new ApiError(500, "update_failed", "Non sono riuscito a decretare il vincitore.");
      }
      if (!updatedSerata) {
        throw new ApiError(404, "not_found", "Serata non trovata.");
      }

      return {
        status: 200,
        data: {
          serata: updatedSerata,
          winner_booking_id: winnerBookingId,
          top5,
        },
      };
    }

    case "cleanup_current_serata":
    case "cleanup_serata": {
      const serataId = body.serataId != null
        ? toPositiveInt(body.serataId, "serataId")
        : (await getOpenSerata(admin))?.id;

      if (!serataId) {
        throw new ApiError(404, "not_found", "Nessuna serata aperta trovata.");
      }
      await ensureSerataAllowsMutations(admin, serataId);

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
    await ensureAdminAuth(req);

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

    const admin = createAdminClient();
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
