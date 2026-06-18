# NEXORA V5.5.5 — Deploy Supabase Edge Functions
# Run from project root:
# powershell -ExecutionPolicy Bypass -File .\scripts\deploy-supabase-functions.ps1 -ProjectRef YOUR_PROJECT_REF

param(
  [Parameter(Mandatory=$false)]
  [string]$ProjectRef = ""
)

$Functions = @(
  "verify-studio-access",
  "create-order",
  "validate-coupon",
  "track-order",
  "studio-dashboard",
  "studio-health-check",
  "checkout-health-check",
  "studio-products",
  "studio-orders",
  "studio-reviews",
  "studio-drops",
  "studio-coupons",
  "studio-promotions",
  "studio-settings",
  "studio-audit-logs",
  "studio-media-upload",
  "studio-media-delete",
  "track-visitor-event",
  "capture-lead",
  "track-whatsapp-click",
  "studio-visitors",
  "studio-leads",
  "studio-customers",
  "studio-campaigns",
  "studio-reports",
  "calculate-shipping",
  "studio-shipping",
  "create-shipment",
  "track-shipment"
)

if ($ProjectRef -and $ProjectRef.Trim().Length -gt 0) {
  Write-Host "Linking Supabase project $ProjectRef..." -ForegroundColor Cyan
  supabase link --project-ref $ProjectRef
}

foreach ($Function in $Functions) {
  Write-Host "Deploying $Function..." -ForegroundColor Cyan
  supabase functions deploy $Function
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to deploy $Function" -ForegroundColor Red
    exit $LASTEXITCODE
  }
}

Write-Host "NEXORA V5.5.5 Recovery Stable functions deployed." -ForegroundColor Green
