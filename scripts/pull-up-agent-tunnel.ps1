# Pull, rebuild, start: flow2api + agent-gateway + redis + cloudflared (same TUNNEL_TOKEN as before).
# Requires .env with TUNNEL_TOKEN. In Cloudflare add Public Hostname → http://agent-gateway:9080
# Run: .\scripts\pull-up-agent-tunnel.ps1

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

Clear-Host
Write-Host "git pull" -ForegroundColor Cyan
git pull
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "docker compose (flow2api + agent-gateway + tunnel)" -ForegroundColor Cyan
docker compose `
  -f docker-compose.yml `
  -f docker-compose.agent-gateway.yml `
  -f docker-compose.tunnel.yml `
  -f docker-compose.agent-gateway.tunnel.yml `
  up -d --build
exit $LASTEXITCODE
