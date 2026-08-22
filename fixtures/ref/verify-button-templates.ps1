param(
    [string]$FixtureRoot = (Join-Path $PSScriptRoot '..'),
    [string]$Manifest = (Join-Path $PSScriptRoot '..\..\autojs\templates\buttons\manifest.json'),
    [string]$OutputRoot = (Join-Path $PSScriptRoot '..\..\autojs\templates\buttons')
)

Add-Type -AssemblyName System.Drawing
$entries = @(Get-Content -Raw -LiteralPath $Manifest | ConvertFrom-Json)
$duplicateIds = $entries | Group-Object id | Where-Object Count -gt 1
if ($duplicateIds) { throw "Duplicate button ids: $($duplicateIds.Name -join ', ')" }

foreach ($entry in $entries) {
    $sourcePath = Join-Path $FixtureRoot $entry.source
    $outputPath = Join-Path $OutputRoot "$($entry.id).png"
    if (-not (Test-Path -LiteralPath $sourcePath)) { throw "Missing source fixture: $sourcePath" }
    if (-not (Test-Path -LiteralPath $outputPath)) { throw "Missing exported template: $outputPath" }

    $source = [System.Drawing.Image]::FromFile($sourcePath)
    $output = [System.Drawing.Image]::FromFile($outputPath)
    try {
        if ($entry.x -lt 0 -or $entry.y -lt 0 -or $entry.width -le 0 -or $entry.height -le 0) { throw "Invalid crop: $($entry.id)" }
        if ($entry.x + $entry.width -gt $source.Width -or $entry.y + $entry.height -gt $source.Height) { throw "Crop exceeds fixture: $($entry.id)" }
        if ($output.Width -ne $entry.width -or $output.Height -ne $entry.height) { throw "Wrong output dimensions: $($entry.id)" }
    } finally {
        $source.Dispose()
        $output.Dispose()
    }
}

"Verified $($entries.Count) button templates."
