<#
.SYNOPSIS
  Generate a Hearthmon builder pass + update the local, zero-telemetry builder registry.
  (secure_Hearthmon.md §8 + Founder's Mark §13.)

.DESCRIPTION
  Pass signature reproduces the Rust byte contract exactly: first 8 hex of
  HMAC-SHA256($env:HEARTHMON_PASS_SECRET, machineHash + yymmdd), uppercased.

  This is your CRM, derived only from passes YOU issue — nothing phones home. The registry
  (tools/builders.json) stays LOCAL (gitignored); commit only the derived badge from
  builders_badge.ps1.

.EXAMPLE
  $env:HEARTHMON_PASS_SECRET = '...'
  .\generate_pass.ps1 -RequestCode HM-7X9K2P4M -Github nightowl-ai -Days 14
  .\generate_pass.ps1 -RequestCode HM-7X9K2P4M -Github devraj -Forever -Wall   # -Wall = list publicly
#>
param(
  [Parameter(Mandatory)][string]$RequestCode,
  [string]$Github,
  [int]$Days,
  [switch]$Forever,
  [switch]$Wall,        # opt the builder into the PUBLIC Founder Wall (count is always tracked)
  [switch]$TrustedLine
)

$secret = $env:HEARTHMON_PASS_SECRET
if (-not $secret) { throw "Set `$env:HEARTHMON_PASS_SECRET to the same value as the Rust build." }

$machineHash = ($RequestCode -replace '^HM-', '').ToLower()
if ($machineHash.Length -ne 8) { throw "RequestCode must look like HM-XXXXXXXX (8 hex chars)." }

$yymmdd =
  if ($Forever) { "999999" }
  elseif ($PSBoundParameters.ContainsKey('Days')) { (Get-Date).AddDays($Days).ToString("yyMMdd") }
  else { throw "Provide -Days <N> or -Forever." }

$msg  = $machineHash + $yymmdd
$hmac = [System.Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($secret))
$sig  = ([BitConverter]::ToString($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($msg))) `
          -replace '-', '').ToLower().Substring(0, 8).ToUpper()
$pass = "PASS-$yymmdd-$sig"

$pass | Set-Clipboard
Write-Host "Pass (copied to clipboard): $pass"

if ($TrustedLine) {
  $grantRust = if ($Forever) { "TrustGrant::Forever" } else { "TrustGrant::Days($Days)" }
  Write-Host "cfg::TRUSTED row:  (`"$machineHash`", $grantRust),"
}

# ── Builder registry (local CRM, zero telemetry) ─────────────────────────────
$registryPath = Join-Path $PSScriptRoot "builders.json"
$reg =
  if (Test-Path $registryPath) { Get-Content $registryPath -Raw | ConvertFrom-Json }
  else { [pscustomobject]@{ updated = ""; builders = @() } }

$builders = @($reg.builders)
$grant = if ($Forever) { "Forever" } else { "Days($Days)" }
$today = (Get-Date).ToString("yyyy-MM-dd")
$existing = $builders | Where-Object { $_.machine -eq $machineHash } | Select-Object -First 1

if ($existing) {
  $existing | Add-Member NoteProperty passes ([int]$existing.passes + 1) -Force
  $existing | Add-Member NoteProperty last   $today                      -Force
  $existing | Add-Member NoteProperty grant  $grant                      -Force
  if ($Github) { $existing | Add-Member NoteProperty github $Github -Force }
  if ($Wall)   { $existing | Add-Member NoteProperty wall   $true   -Force }
} else {
  $builders += [pscustomobject]@{
    github = $Github; machine = $machineHash; grant = $grant
    first = $today; last = $today; passes = 1; wall = [bool]$Wall
  }
}

$reg | Add-Member NoteProperty builders $builders -Force
$reg | Add-Member NoteProperty updated (Get-Date).ToString("s") -Force
$reg | ConvertTo-Json -Depth 6 | Set-Content $registryPath -Encoding utf8

$count = @($builders).Count
Write-Host ""
Write-Host "Registry updated -> $count builder(s)."
Write-Host ("  " + [char]0x2726 + " Hearthmon has quietly stayed beside $count builders")
