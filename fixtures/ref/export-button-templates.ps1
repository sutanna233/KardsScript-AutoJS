param(
    [string]$FixtureRoot = (Join-Path $PSScriptRoot '..'),
    [string]$Manifest = (Join-Path $PSScriptRoot '..\..\autojs\templates\buttons\manifest.json'),
    [string]$OutputRoot = (Join-Path $PSScriptRoot '..\..\autojs\templates\buttons')
)

Add-Type -AssemblyName System.Drawing
$entries = Get-Content -Raw -LiteralPath $Manifest | ConvertFrom-Json
New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null

foreach ($entry in $entries) {
    $sourcePath = Join-Path $FixtureRoot $entry.source
    if (-not (Test-Path -LiteralPath $sourcePath)) { throw "Missing source fixture: $sourcePath" }
    $bitmap = [System.Drawing.Bitmap]::FromFile($sourcePath)
    try {
        $rect = [System.Drawing.Rectangle]::new($entry.x, $entry.y, $entry.width, $entry.height)
        if ($rect.Right -gt $bitmap.Width -or $rect.Bottom -gt $bitmap.Height) { throw "Crop $($entry.id) exceeds $($entry.source)" }
        $crop = $bitmap.Clone($rect, $bitmap.PixelFormat)
        try { $crop.Save((Join-Path $OutputRoot "$($entry.id).png"), [System.Drawing.Imaging.ImageFormat]::Png) }
        finally { $crop.Dispose() }
    } finally { $bitmap.Dispose() }
}

"Exported $($entries.Count) button templates to $OutputRoot"
