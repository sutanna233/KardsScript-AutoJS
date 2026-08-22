param(
    [string]$Device = "127.0.0.1:5555",
    [string]$RemoteRoot = "/sdcard/AutoJs6/KardsScript/autojs"
)

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

adb -s $Device get-state | Out-Null
adb -s $Device push "$projectRoot/." "$RemoteRoot/"
if ($LASTEXITCODE -ne 0) {
    throw "Auto.js project sync failed"
}

$critical = @(
    "auto-main.js",
    "lib/config.js",
    "lib/coordinates.js",
    "lib/driver.js",
    "lib/runtime.js",
    "lib/strategy.js",
    "lib/vision.js"
)

foreach ($relative in $critical) {
    $localHash = (Get-FileHash (Join-Path $projectRoot $relative) -Algorithm SHA256).Hash.ToLowerInvariant()
    $remoteLine = adb -s $Device shell "sha256sum '$RemoteRoot/$relative'"
    $remoteHash = (($remoteLine -split '\s+')[0]).Trim().ToLowerInvariant()
    if ($localHash -ne $remoteHash) {
        throw "Hash mismatch after sync: $relative"
    }
}

Write-Output "Synced and verified $($critical.Count) critical files to $Device"
