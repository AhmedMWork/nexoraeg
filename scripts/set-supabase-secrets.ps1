# NEXORA — Set required custom Supabase Edge Function secrets
# Supabase automatically provides SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to hosted Edge Functions.
# Do NOT set secrets that start with SUPABASE_; the CLI rejects them and they should not be copied around.
# Example:
# powershell -ExecutionPolicy Bypass -File .\scripts\set-supabase-secrets.ps1 -ProjectRef ccmuazjkgzjqzybxwrfd -StudioPin "12345678" -StudioSessionSecret "long-random-secret" -AllowedOrigin "https://nexoraeg.vercel.app"

param(
  [Parameter(Mandatory=$true)][string]$ProjectRef,
  [Parameter(Mandatory=$true)][string]$StudioPin,
  [Parameter(Mandatory=$true)][string]$StudioSessionSecret,
  [Parameter(Mandatory=$false)][string]$AllowedOrigin = "",
  [Parameter(Mandatory=$false)][string]$ShipBluApiKey = "",
  [Parameter(Mandatory=$false)][string]$ShipBluBaseUrl = ""
)

supabase secrets set REQUIRE_STUDIO_PIN="true" --project-ref $ProjectRef
supabase secrets set STUDIO_ACCESS_PIN="$StudioPin" --project-ref $ProjectRef
supabase secrets set STUDIO_SESSION_SECRET="$StudioSessionSecret" --project-ref $ProjectRef

if ($AllowedOrigin -ne "") {
  supabase secrets set ALLOWED_ORIGIN="$AllowedOrigin" --project-ref $ProjectRef
}

if ($ShipBluApiKey -ne "") {
  supabase secrets set SHIPBLU_API_KEY="$ShipBluApiKey" --project-ref $ProjectRef
}

if ($ShipBluBaseUrl -ne "") {
  supabase secrets set SHIPBLU_BASE_URL="$ShipBluBaseUrl" --project-ref $ProjectRef
}

Write-Host "NEXORA custom Supabase secrets set." -ForegroundColor Green
Write-Host "Note: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are managed automatically by Supabase Edge Functions." -ForegroundColor Yellow
