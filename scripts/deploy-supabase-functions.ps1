# NEXORA V5 — Deploy Supabase Edge Functions
# Run from project root:
# powershell -ExecutionPolicy Bypass -File .\scripts\deploy-supabase-functions.ps1 -ProjectRef YOUR_PROJECT_REF

param(
  [Parameter(Mandatory=$true)]
  [string]$ProjectRef
)

$Functions = @(
  "verify-studio-access",
  "create-order",
  "validate-coupon",
  "track-order",
  "studio-dashboard",
  "studio-products",
  "studio-orders",
  "studio-reviews",
  "studio-drops",
  "studio-coupons",
  "studio-settings",
  "studio-media-upload",
  "studio-media-delete"
)

foreach ($Function in $Functions) {
  Write-Host "Deploying $Function..." -ForegroundColor Cyan
  supabase functions deploy $Function --project-ref $ProjectRef
}

Write-Host "NEXORA V5 functions deployed." -ForegroundColor Green
