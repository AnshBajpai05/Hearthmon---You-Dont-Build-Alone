<#
.SYNOPSIS
  Render the Hearthmon "living badge" + opt-in Founder Wall from the local builder registry.
  (Founder's Mark - manual, artisanal, zero telemetry.)

.DESCRIPTION
  Reads tools/builders.json (kept local). COUNTS every builder; LISTS only those with wall=true
  (explicit opt-in). Prints a README-ready markdown snippet. With -Write, replaces the block
  between <!--BUILDERS:START--> and <!--BUILDERS:END--> in ../README.md.

  NOTE: source is ASCII-only on purpose (Windows PowerShell 5.1 reads .ps1 as ANSI without a
  BOM); the star/dot glyphs are built from char codes so they survive into the output.

.EXAMPLE
  .\builders_badge.ps1            # print snippet
  .\builders_badge.ps1 -Write     # update README between the markers
#>
param([switch]$Write)

$star = [char]0x2726   # the Hearthmon mark
$dot  = [char]0x00B7   # middot separator

$registryPath = Join-Path $PSScriptRoot "builders.json"
if (-not (Test-Path $registryPath)) { throw "No builders.json yet - issue a pass first." }

$reg = Get-Content $registryPath -Raw | ConvertFrom-Json
$builders = @($reg.builders)
$count = $builders.Count
$wall = @($builders | Where-Object { $_.wall -eq $true -and $_.github } | ForEach-Object { "@$($_.github)" })

$lines = @("$star Hearthmon has quietly stayed beside **$count** builders")
if ($wall.Count) {
  $lines += ""
  $lines += "_latest chapters:_ " + ($wall -join " $dot ")
}
$snippet = $lines -join "`n"

Write-Output $snippet

if ($Write) {
  $readme = Join-Path $PSScriptRoot "..\README.md"
  if (-not (Test-Path $readme)) { throw "README.md not found at $readme" }
  $start = "<!--BUILDERS:START-->"
  $end = "<!--BUILDERS:END-->"
  # Read/write as UTF-8 explicitly via .NET. PowerShell 5.1's Get-Content/Set-Content default to
  # ANSI without a BOM, which would mojibake the whole file on a round-trip.
  $bodyText = [System.IO.File]::ReadAllText($readme)
  if ($bodyText -notmatch [regex]::Escape($start)) {
    throw "Add the markers to README.md first: $start ... $end"
  }
  $pattern = "(?s)" + [regex]::Escape($start) + ".*?" + [regex]::Escape($end)
  $replacement = $start + "`n" + $snippet + "`n" + $end
  $newBody = [regex]::Replace($bodyText, $pattern, { param($m) $replacement })
  [System.IO.File]::WriteAllText($readme, $newBody, (New-Object System.Text.UTF8Encoding($false)))
  Write-Host "README.md updated between the markers."
}
