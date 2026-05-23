#!/usr/bin/env bash
# =============================================================
#  karaoke-tana – Entrypoint container Docker-in-Docker
# =============================================================
set -euo pipefail

GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'
RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'
log()  { echo -e "${CYAN}[karaoke-dev]${NC} $*"; }
ok()   { echo -e "${GREEN}[karaoke-dev]${NC} $*"; }
warn() { echo -e "${YELLOW}[karaoke-dev]${NC} $*"; }
err()  { echo -e "${RED}[karaoke-dev] ERRORE:${NC} $*" >&2; }

# ── 1. Pulizia stato residuo da run precedenti ────────────────
log "Pulizia stato Docker residuo..."
rm -f /var/run/docker.pid /var/run/docker.sock 2>/dev/null || true
rm -f /var/lib/docker/network/files/local-kv.db 2>/dev/null || true
rm -f /run/docker.pid 2>/dev/null || true

# ── 2. Avvio daemon Docker (DinD) ────────────────────────────
log "Avvio daemon Docker interno..."
dockerd \
  --host=unix:///var/run/docker.sock \
  --tls=false \
  --storage-driver=overlay2 \
  &>/var/log/dockerd.log &

log "Attendo che Docker sia pronto..."
TIMEOUT=60
ELAPSED=0
until docker info >/dev/null 2>&1; do
  if [ $ELAPSED -ge $TIMEOUT ]; then
    err "Docker daemon non risponde dopo ${TIMEOUT}s."
    cat /var/log/dockerd.log >&2
    exit 1
  fi
  sleep 1
  ELAPSED=$((ELAPSED + 1))
done
ok "Docker daemon pronto (${ELAPSED}s)."

cd /workspace

# ── 3. config.js con valori di default (prima di tutto) ──────
log "Generazione config.js iniziale..."
SUPABASE_URL="http://localhost:54321" \
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRFA0NiK7W9oHXoJIcXHKhBp8nOrGXv5MJkFmVVBbOM" \
BOOKING_PENDING_EXPIRY_MIN="${BOOKING_PENDING_EXPIRY_MIN:-30}" \
BOOKING_COOLDOWN_MIN="${BOOKING_PENDING_EXPIRY_MIN:-30}" \
ADS_ENABLED="false" \
ADS_MODE="off" \
  node /workspace/scripts/generate-pages-config.mjs /workspace
ok "config.js generato."

# ── 4. Web server (parte subito, prima di supabase start) ─────
log "Avvio web server su porta 3000..."
serve /workspace --listen tcp://0.0.0.0:3000 &
SERVE_PID=$!
ok "Web server attivo → http://localhost:3000 (Supabase non ancora pronto)"

# ── 5. Pulizia container/reti orfane dal run precedente ───────
log "Pulizia container e reti orfane..."
docker ps -aq | xargs -r docker rm -f 2>/dev/null || true
docker network prune -f 2>/dev/null || true
ok "Pulizia completata."

# ── 6. supabase start ─────────────────────────────────────────
echo ""
log "Avvio stack Supabase (prima volta: ~5-10 min per download immagini)..."
echo ""

if ! supabase start; then
  err "supabase start fallito. Log dockerd:"
  cat /var/log/dockerd.log >&2
  wait $SERVE_PID
  exit 1
fi

echo ""
ok "Stack Supabase avviato."

# ── 7. Leggi anon key e service_role key ─────────────────────
log "Lettura credenziali Supabase locali..."

ANON_KEY=""
SERVICE_ROLE_KEY=""
ENV_OUT=$(supabase status --output env 2>/dev/null || true)

if [ -n "$ENV_OUT" ]; then
  ANON_KEY=$(echo "$ENV_OUT" | grep "^ANON_KEY=" | cut -d= -f2 | tr -d '"' | tr -d "'" | tr -d ' ')
  SERVICE_ROLE_KEY=$(echo "$ENV_OUT" | grep "^SERVICE_ROLE_KEY=" | cut -d= -f2 | tr -d '"' | tr -d "'" | tr -d ' ')
fi

# Fallback: parsa la tabella testuale
if [ -z "$ANON_KEY" ]; then
  warn "Parsing con --output env fallito, provo formato tabella..."
  STATUS_TXT=$(supabase status 2>/dev/null || true)
  ANON_KEY=$(echo "$STATUS_TXT" \
    | grep -E "(anon key|Publishable)" \
    | grep -v -i "secret" \
    | awk -F'│' '{print $3}' \
    | tr -d ' ' \
    | head -1)
  if [ -z "$ANON_KEY" ]; then
    ANON_KEY=$(echo "$STATUS_TXT" \
      | grep -i "anon key" \
      | awk '{print $NF}' \
      | tr -d ' ')
  fi
  SERVICE_ROLE_KEY=$(echo "$STATUS_TXT" \
    | grep -E "(service_role|Secret)" \
    | grep -v -i "publishable" \
    | awk -F'│' '{print $3}' \
    | tr -d ' ' \
    | head -1)
  if [ -z "$SERVICE_ROLE_KEY" ]; then
    SERVICE_ROLE_KEY=$(echo "$STATUS_TXT" \
      | grep -i "service_role" \
      | awk '{print $NF}' \
      | tr -d ' ')
  fi
fi

if [ -z "$ANON_KEY" ]; then
  err "Impossibile leggere la chiave anon. Controlla 'supabase status'."
  wait $SERVE_PID
  exit 1
fi

ok "Chiave anon:          ${ANON_KEY:0:20}..."
ok "Chiave service_role:  ${SERVICE_ROLE_KEY:0:20}..."

# ── 8. Genera config.js con la chiave reale ───────────────────
log "Generazione config.js..."
SUPABASE_URL="http://localhost:54321" \
SUPABASE_ANON_KEY="$ANON_KEY" \
BOOKING_PENDING_EXPIRY_MIN="${BOOKING_PENDING_EXPIRY_MIN:-30}" \
BOOKING_COOLDOWN_MIN="${BOOKING_PENDING_EXPIRY_MIN:-30}" \
ADS_ENABLED="false" \
ADS_MODE="off" \
  node /workspace/scripts/generate-pages-config.mjs /workspace
ok "config.js generato."

# ── 9. Seed utente admin via Admin API ────────────────────────
if [ -n "$SERVICE_ROLE_KEY" ]; then
  log "Creazione utente admin (admin@tana.it)..."
  SUPABASE_URL="http://localhost:54321" \
  SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
    node /workspace/scripts/seed-admin.mjs \
    && ok "Utente admin pronto." \
    || warn "Seed admin fallito — crea manualmente da Supabase Studio."
else
  warn "SERVICE_ROLE_KEY non disponibile — seed admin saltato."
  warn "Crea l'utente admin manualmente da Supabase Studio."
fi

# ── Riepilogo ─────────────────────────────────────────────────
echo ""
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo -e "${GREEN}  karaoke-tana – tutto pronto!${NC}"
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo ""
echo -e "  ${CYAN}Web app${NC}          →  http://localhost:3000"
echo -e "  ${CYAN}Admin panel${NC}      →  http://localhost:3000/admin.html"
echo -e "  ${CYAN}Votazione${NC}        →  http://localhost:3000/vota.html"
echo -e "  ${CYAN}Supabase Studio${NC}  →  http://localhost:54323"
echo -e "  ${CYAN}Supabase API${NC}     →  http://localhost:54321"
echo -e "  ${CYAN}Inbucket (email)${NC} →  http://localhost:54324"
echo ""
echo -e "  ${YELLOW}Credenziali admin:${NC}"
echo -e "    Email:    admin@tana.it"
echo -e "    Password: nanatuttatana2026"
echo ""
echo -e "  ${YELLOW}Comandi utili:${NC}"
echo -e "    docker exec -it karaoke-tana-dev supabase db reset"
echo -e "    docker exec -it karaoke-tana-dev supabase status"
echo -e "    docker exec -it karaoke-tana-dev bash"
echo ""
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo ""

wait $SERVE_PID
