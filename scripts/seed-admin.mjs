#!/usr/bin/env node
// =============================================================
//  Seed utente admin via Supabase REST Admin API
//
//  Non usa npm — chiama direttamente le API REST di Supabase
//  (GoTrue /auth/v1/admin/users e PostgREST /rest/v1/admin_users).
//  Node.js 18+ ha fetch built-in, nessuna dipendenza esterna.
//
//  Env richiesti:
//    SUPABASE_URL              http://localhost:54321
//    SUPABASE_SERVICE_ROLE_KEY  service_role key locale
// =============================================================

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('[seed-admin] SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sono obbligatorie')
  process.exit(1)
}

const EMAIL = 'admin@tana.it'
const PASSWORD = 'nanatuttatana2026'

const authHeaders = {
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'apikey': SERVICE_ROLE_KEY,
  'Content-Type': 'application/json'
}

// ── 1. Cerca utente esistente ──────────────────────────────
const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
  headers: authHeaders
})
if (!listRes.ok) {
  console.error('[seed-admin] Errore listUsers:', await listRes.text())
  process.exit(1)
}
const { users } = await listRes.json()
let userId = users?.find(u => u.email === EMAIL)?.id

// ── 2. Crea se non esiste ──────────────────────────────────
if (!userId) {
  const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true })
  })
  const created = await createRes.json()
  if (!createRes.ok) {
    console.error('[seed-admin] Errore createUser:', JSON.stringify(created))
    process.exit(1)
  }
  userId = created.id
  console.log(`[seed-admin] Utente ${EMAIL} creato (id: ${userId})`)
} else {
  console.log(`[seed-admin] Utente ${EMAIL} già esistente (id: ${userId})`)
}

// ── 3. Aggiungi ad admin_users (idempotente) ───────────────
const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/admin_users`, {
  method: 'POST',
  headers: { ...authHeaders, 'Prefer': 'resolution=ignore-duplicates' },
  body: JSON.stringify({ user_id: userId })
})
if (!upsertRes.ok) {
  console.error('[seed-admin] Errore upsert admin_users:', await upsertRes.text())
  process.exit(1)
}

console.log(`[seed-admin] ${EMAIL} aggiunto ad admin_users`)
