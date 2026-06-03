#!/usr/bin/env bash
# =============================================================
#  karaoke-tana – Reset DB + seed admin
#
#  Equivale a "supabase db reset" ma riesegue anche il seed
#  dell'utente admin via Admin API (altrimenti perso dopo reset).
#
#  Uso (dall'host Windows):
#    docker exec -it karaoke-tana-dev /workspace/scripts/dev-reset.sh
# =============================================================
set -euo pipefail

GREEN='\033[0;32m'; CYAN='\033[0;36m'; RED='\033[0;31m'; NC='\033[0m'
log() { echo -e "${CYAN}[dev-reset]${NC} $*"; }
ok()  { echo -e "${GREEN}[dev-reset]${NC} $*"; }
err() { echo -e "${RED}[dev-reset] ERRORE:${NC} $*" >&2; }

cd /workspace

log "Reset database (applica tutte le migrazioni)..."
supabase db reset
ok "Reset completato."

log "Lettura service_role key..."
ENV_OUT=$(supabase status --output env 2>/dev/null || true)
SERVICE_ROLE_KEY=$(echo "$ENV_OUT" | grep "^SERVICE_ROLE_KEY=" | cut -d= -f2 | tr -d '"' | tr -d "'" | tr -d ' ')

if [ -z "$SERVICE_ROLE_KEY" ]; then
  err "SERVICE_ROLE_KEY non disponibile. Seed admin saltato."
  err "Crea l'utente manualmente da Supabase Studio (http://localhost:54323)."
  exit 1
fi

log "Seed utente admin..."
SUPABASE_URL="http://localhost:54321" \
SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
  node /workspace/scripts/seed-admin.mjs

ok "Done! Credenziali admin:"
echo "  Email:    admin@tana.it"
echo "  Password: nanatuttatana2026"
