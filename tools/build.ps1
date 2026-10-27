# Build Atelier, and optionally install and launch it on a paired TV.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File tools\build.ps1
#   powershell -ExecutionPolicy Bypass -File tools\build.ps1 -Device mytv
#
# -Device is the name you gave the TV in `ares-setup-device`.
# Nothing on the TV changes unless you pass -Device.

param(
  [string]$Device = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Push-Location $root
try {
  node tools/fetch-icons.js
  if ($LASTEXITCODE -ne 0) {
    throw "Icon download failed. Fix the failures above, or replace the missing PNGs manually."
  }

  New-Item -ItemType Directory -Force dist | Out-Null
  ares-package app -o dist
  if ($LASTEXITCODE -ne 0) {
    throw "ares-package failed. Is the webOS CLI installed and on PATH?"
  }

  $ipk = Get-ChildItem dist -Filter "com.atelier.gallery_*.ipk" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if (-not $ipk) {
    throw "No IPK was produced."
  }

  Write-Host ""
  Write-Host "Package: $($ipk.FullName)"
  Write-Host "Size:    $([math]::Round($ipk.Length / 1MB, 2)) MB"

  if ($Device) {
    ares-install -d $Device $ipk.FullName
    if ($LASTEXITCODE -ne 0) {
      throw "Install failed. Check the device name and that Developer Mode is still paired."
    }
    ares-launch -d $Device com.atelier.gallery
    if ($LASTEXITCODE -ne 0) {
      throw "Launch failed."
    }
  } else {
    Write-Host ""
    Write-Host "Install: ares-install -d <device> `"$($ipk.FullName)`""
    Write-Host "Launch:  ares-launch -d <device> com.atelier.gallery"
  }
}
finally {
  Pop-Location
}
