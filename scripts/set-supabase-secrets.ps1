# NEXORA V5 — Set required Supabase Edge Function secrets
# Example:
# powershell -ExecutionPolicy Bypass -File .\scripts\set-supabase-secrets.ps1 -ProjectRef xxx -SupabaseUrl https://xxx.supabase.co -ServiceRoleKey xxx -StudioPin 123456 -StudioSessionSecret "long-random-secret"

param(
  [Parameter(Mandatory=$true)][string]$ProjectRef,
  [Parameter(Mandatory=$true)][string]$SupabaseUrl,
  [Parameter(Mandatory=$true)][string]$ServiceRoleKey,
  [Parameter(Mandatory=$true)][string]$StudioPin,
  [Parameter(Mandatory=$true)][string]$StudioSessionSecret
)

supabase secrets set SUPABASE_URL="$SupabaseUrl" --project-ref $ProjectRef
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="$ServiceRoleKey" --project-ref $ProjectRef
supabase secrets set REQUIRE_STUDIO_PIN="true" --project-ref $ProjectRef
supabase secrets set STUDIO_ACCESS_PIN="$StudioPin" --project-ref $ProjectRef
supabase secrets set STUDIO_SESSION_SECRET="$StudioSessionSecret" --project-ref $ProjectRef

Write-Host "NEXORA V5 Supabase secrets set. Keep the service role key and Studio PIN private." -ForegroundColor Green
