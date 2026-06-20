# make_release.ps1 — assemble a signed auto-update release.
#
# After a signed `tauri build` (createUpdaterArtifacts=true + signing key set), this gathers the
# NSIS setup installer, its minisign signature, and writes the `latest.json` manifest the Tauri
# updater reads from GitHub Releases. Output lands in dist\release\.
#
# Friends download the setup ONCE from the GitHub Release; every future update is detected
# in-app and installed from there. See UPDATER_SETUP.md for the full release checklist.
param(
  [string]$Owner = "AnshBajpai05",
  [string]$Repo  = "Hearthmon-Trial_Beta",
  [string]$Root  = (Split-Path $PSScriptRoot -Parent)  # hearthmon\
)
$ErrorActionPreference = "Stop"

# Version is the single source of truth for the updater's compare — bump it in BOTH
# tauri.conf.json and Cargo.toml before building (see UPDATER_SETUP.md).
$conf = Get-Content (Join-Path $Root "src-tauri\tauri.conf.json") -Raw | ConvertFrom-Json
$version = $conf.version
if (-not $version) { throw "Could not read version from tauri.conf.json" }

$nsisDir = Join-Path $Root "src-tauri\target\release\bundle\nsis"
$setup = Get-ChildItem $nsisDir -Filter "*-setup.exe" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime | Select-Object -Last 1
if (-not $setup) {
  throw "No NSIS setup .exe in $nsisDir. Did the signed build run? (targets must include nsis.)"
}
$sigPath = "$($setup.FullName).sig"
if (-not (Test-Path $sigPath)) {
  throw "No .sig beside $($setup.Name). Is createUpdaterArtifacts on AND the signing key set?"
}

$signature = (Get-Content $sigPath -Raw).Trim()
$assetName = $setup.Name
$downloadUrl = "https://github.com/$Owner/$Repo/releases/download/v$version/$assetName"

# latest.json — exactly the shape tauri-plugin-updater expects. Add darwin-*/linux-* keys here
# later for cross-platform; Windows-only for now (forward-compatible).
$manifest = [ordered]@{
  version   = $version
  notes     = "See the release notes on GitHub."
  pub_date  = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  platforms = [ordered]@{
    "windows-x86_64" = [ordered]@{
      signature = $signature
      url       = $downloadUrl
    }
  }
}

$out = Join-Path $Root "dist\release"
New-Item -ItemType Directory -Force -Path $out | Out-Null
Copy-Item $setup.FullName (Join-Path $out $assetName) -Force
# WriteAllText(path, contents) is UTF-8 WITHOUT BOM — serde_json on the updater side rejects a BOM.
$json = $manifest | ConvertTo-Json -Depth 6
[System.IO.File]::WriteAllText((Join-Path $out "latest.json"), $json)

Write-Host ""
Write-Host "[make_release] v$version ready in dist\release\:"
Write-Host "    $assetName   (the installer friends download once)"
Write-Host "    latest.json            (url -> $downloadUrl)"
Write-Host ""
Write-Host "NEXT (gated release step):"
Write-Host "  1. Create a GitHub Release on $Owner/$Repo with tag  v$version"
Write-Host "  2. Upload BOTH files above as release assets"
Write-Host "  3. Publish (NOT pre-release) so /releases/latest/download/latest.json resolves"
