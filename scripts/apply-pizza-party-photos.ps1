# Make the 21 new Pizza Party photographs appear - website, checkout and both apps.
#
# Run this AFTER Coolify has finished redeploying pizza-party, because the SQL
# points at image files that only exist inside the new image.
#
#   .\scripts\apply-pizza-party-photos.ps1
#
# Safe to run twice. Every UPDATE is guarded on image='', so it fills blanks
# only and can never overwrite a photograph the owner has set from the back
# office. It does not touch prices, orders or anything else.
#
# Containers are found by their Coolify service label rather than by name,
# because a redeploy gives them a new name every time.

$ErrorActionPreference = "Stop"

$Server = "root@46.225.104.128"
$Key    = Join-Path $env:USERPROFILE ".ssh\hetzner_ed25519"
$Sql    = Join-Path $PSScriptRoot "apply-images-pizza-party.sql"

if (-not (Test-Path $Sql)) { Write-Error "cannot find $Sql"; exit 1 }
if (-not (Test-Path $Key)) { Write-Error "cannot find ssh key at $Key"; exit 1 }

Write-Host "==> 1/3  applying image paths to the pizza-party database" -ForegroundColor Cyan
$applyCmd = 'docker exec -i $(docker ps -q --filter label=coolify.serviceName=pizza-party-db) sh -c "psql -v ON_ERROR_STOP=1 -U \$POSTGRES_USER -d \$POSTGRES_DB"'
Get-Content $Sql -Raw | & ssh -i $Key -o StrictHostKeyChecking=no $Server $applyCmd
if ($LASTEXITCODE -ne 0) { Write-Error "the database update failed - nothing was changed"; exit 1 }

Write-Host "==> 2/3  restarting the web container so Next drops its cached menu" -ForegroundColor Cyan
& ssh -i $Key -o StrictHostKeyChecking=no $Server 'docker restart $(docker ps -q --filter label=coolify.serviceName=pizza-party)' | Out-Null

Write-Host "==> 3/3  waiting for it to come back, then checking" -ForegroundColor Cyan
for ($i = 0; $i -lt 30; $i++) {
  try {
    $r = Invoke-WebRequest -Uri "https://pizzaparty.live/api/health" -TimeoutSec 10 -UseBasicParsing
    if ($r.StatusCode -eq 200) { break }
  } catch { }
  Start-Sleep -Seconds 5
}

Write-Host ""
Write-Host "--- image files ---"
foreach ($f in @("products/pepsi-can.jpg", "products/chicken-strips-wrap.jpg", "categories/wraps.jpg")) {
  try {
    $r = Invoke-WebRequest -Uri "https://pizzaparty.live/brand/$f" -TimeoutSec 15 -UseBasicParsing
    $code = $r.StatusCode
  } catch { $code = $_.Exception.Response.StatusCode.value__ }
  "  {0,-34} {1}" -f $f, $code | Write-Host
}

Write-Host ""
Write-Host "--- what the apps will now be sent ---"
$menu = Invoke-RestMethod -Uri "https://pizzaparty.live/api/menu" -TimeoutSec 30
$noCat = 0; $noProd = 0; $prod = 0
foreach ($c in $menu.categories) {
  if (-not $c.image) { $noCat++ }
  foreach ($p in $c.products) { $prod++; if (-not $p.image) { $noProd++ } }
}
Write-Host ("  categories without an image: {0} of {1}" -f $noCat, $menu.categories.Count)
Write-Host ("  products   without an image: {0} of {1}" -f $noProd, $prod)
Write-Host ""
if ($noCat -eq 0 -and $noProd -eq 0) {
  Write-Host "  DONE - every category and product has a photograph." -ForegroundColor Green
} else {
  Write-Host "  STILL MISSING - the deploy may not have finished; re-run this script." -ForegroundColor Yellow
}
