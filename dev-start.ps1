# =============================================================
#  karaoke-tana – Avvio ambiente di sviluppo locale
#
#  Esegui con:
#    .\dev-start.ps1
#
#  Requisiti:
#    - Docker Desktop installato e in esecuzione
# =============================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  karaoke-tana – avvio dev environment" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $PSScriptRoot

# Controlla Docker
Write-Host "[1/2] Verifica Docker..." -ForegroundColor Yellow
try {
    docker info | Out-Null
} catch {
    Write-Host "ERRORE: Docker non risponde. Assicurati che Docker Desktop sia avviato." -ForegroundColor Red
    Read-Host "Premi Invio per uscire"
    exit 1
}
Write-Host "      Docker OK" -ForegroundColor Green

# Avvia il container (Docker-in-Docker: Supabase gira dentro)
Write-Host ""
Write-Host "[2/2] Avvio container (prima volta: ~5 min per download immagini)..." -ForegroundColor Yellow
Write-Host "      Le volte successive usa la cache ed e' molto piu' veloce." -ForegroundColor Gray
Write-Host ""

docker compose -f docker-compose.dev.yml up --build

Write-Host ""
Write-Host "Container fermato." -ForegroundColor Yellow
Write-Host "La cache delle immagini Docker e' preservata per il prossimo avvio." -ForegroundColor Gray
Write-Host "Per cancellarla: docker compose -f docker-compose.dev.yml down -v" -ForegroundColor Gray
Write-Host ""
Read-Host "Premi Invio per uscire"
