<#
Validates the default UI-screen calibration against the source PNG fixtures.
Keep the rule values aligned with LayoutProfile.defaultUiScreenRules().
Requires Windows System.Drawing (available on the development machine).
#>
param(
    [string]$FixtureRoot = (Join-Path $PSScriptRoot '..')
)

Add-Type -AssemblyName System.Drawing

$regions = @{
    topUi = @(0.00, 0.00, 1.00, 0.11)
    menuCenter = @(0.25, 0.15, 0.75, 0.80)
    modeFlyout = @(0.18, 0.14, 0.39, 0.86)
    rightPanel = @(0.73, 0.08, 1.00, 0.96)
    deckStartButton = @(0.72, 0.80, 0.98, 0.94)
    enemyHqAnchor = @(0.43, 0.12, 0.57, 0.34)
    playerHqAnchor = @(0.43, 0.62, 0.57, 0.84)
    cardsNav = @(0.00, 0.40, 0.15, 0.63)
    shopNav = @(0.00, 0.63, 0.15, 0.87)
    menuContent = @(0.05, 0.15, 0.95, 0.92)
    endTurnUi = @(0.82, 0.68, 0.98, 0.78)
    deckChoiceMiddle = @(0.37, 0.16, 0.63, 0.84)
    deckChoiceRight = @(0.67, 0.16, 0.93, 0.84)
}

$rules = @(
    @{ id='home'; screen='HOME'; priority=20; anchors=@(@{r='topUi';minL=48}, @{r='menuCenter';minL=60}, @{r='rightPanel';minS=65}) },
    @{ id='mode-menu'; screen='MODE_MENU'; priority=25; anchors=@(@{r='topUi';minL=48}, @{r='modeFlyout';maxL=60}) },
    @{ id='training-deck-chooser'; screen='DECK_LIST'; priority=55; anchors=@(@{r='topUi';maxL=35}, @{r='deckChoiceMiddle';minL=90;maxS=65}, @{r='deckChoiceRight';minL=80}) },
    @{ id='deck-list'; screen='DECK_LIST'; priority=24; anchors=@(@{r='topUi';minL=48}, @{r='menuCenter';maxL=65}, @{r='rightPanel';minS=85}) },
    @{ id='deck-detail'; screen='DECK_DETAIL'; priority=30; anchors=@(@{r='topUi';maxL=45}, @{r='deckStartButton';minL=88;maxS=50}) },
    @{ id='card-collection'; screen='CARD_COLLECTION'; priority=35; anchors=@(@{r='topUi';minL=50;maxL=70}, @{r='cardsNav';maxL=50}, @{r='menuContent';minL=65;maxS=45}, @{r='rightPanel';maxS=40}) },
    @{ id='shop'; screen='SHOP'; priority=35; anchors=@(@{r='topUi';minL=50;maxL=70}, @{r='shopNav';maxL=45}, @{r='menuContent';maxL=55}, @{r='rightPanel';maxL=50;maxS=30}) },
    @{ id='mulligan'; screen='MULLIGAN'; priority=50; anchors=@(@{r='topUi';maxL=28}, @{r='enemyHqAnchor';minE=.14}, @{r='playerHqAnchor';minL=80}, @{r='rightPanel';maxL=30}, @{r='endTurnUi';maxL=45}) },
    @{ id='battle'; screen='BATTLE'; priority=40; anchors=@(@{r='topUi';minL=25;maxL=45}, @{r='rightPanel';minS=110}, @{r='playerHqAnchor';minE=.15}, @{r='endTurnUi';minL=60;minS=80}) }
)

function Get-Feature([System.Drawing.Bitmap]$bitmap, $bounds) {
    $x0 = [Math]::Max(0, [int]($bounds[0] * $bitmap.Width)); $y0 = [Math]::Max(0, [int]($bounds[1] * $bitmap.Height))
    $x1 = [Math]::Min($bitmap.Width, [int]($bounds[2] * $bitmap.Width)); $y1 = [Math]::Min($bitmap.Height, [int]($bounds[3] * $bitmap.Height))
    $luminance = 0.0; $saturation = 0.0; $edges = 0; $count = 0
    for ($y = $y0; $y -lt $y1; $y += 3) {
        for ($x = $x0; $x -lt $x1; $x += 3) {
            $color = $bitmap.GetPixel($x, $y); $luma = .2126 * $color.R + .7152 * $color.G + .0722 * $color.B
            $luminance += $luma; $high = [Math]::Max($color.R, [Math]::Max($color.G, $color.B)); $low = [Math]::Min($color.R, [Math]::Min($color.G, $color.B))
            if ($high -gt 0) { $saturation += (($high - $low) / $high * 255) }
            if ($x + 3 -lt $x1) { $next = $bitmap.GetPixel($x + 3, $y); $nextLuma = .2126 * $next.R + .7152 * $next.G + .0722 * $next.B; if ([Math]::Abs($luma - $nextLuma) -gt 36) { $edges++ } }
            $count++
        }
    }
    @{ L = $luminance / $count; S = $saturation / $count; E = $edges / $count }
}

function Test-Anchor($feature, $anchor) {
    ($null -eq $anchor.minL -or $feature.L -ge $anchor.minL) -and ($null -eq $anchor.maxL -or $feature.L -le $anchor.maxL) -and
    ($null -eq $anchor.minS -or $feature.S -ge $anchor.minS) -and ($null -eq $anchor.maxS -or $feature.S -le $anchor.maxS) -and
    ($null -eq $anchor.minE -or $feature.E -ge $anchor.minE) -and ($null -eq $anchor.maxE -or $feature.E -le $anchor.maxE)
}

$expected = @{
    'kards_current_screen.png' = 'HOME'; 'menu.png' = 'MODE_MENU'; 'kards-now.png' = 'DECK_LIST'
    'b1.png' = 'DECK_DETAIL'; 'battle-final.png' = 'MULLIGAN'; 'card-select.png' = 'BATTLE'
    'card-collection-live.png' = 'CARD_COLLECTION'; 'shop-live.png' = 'SHOP'; 'kards-home-auto-debug.png' = 'MODE_MENU'
    'kards-next-auto-debug.png' = 'DECK_DETAIL'; 'kards-template-live.png' = 'MODE_MENU'
    'kards-mulligan-auto-debug.png' = 'DECK_LIST'
}
$failures = @()
foreach ($entry in $expected.GetEnumerator()) {
    $image = [System.Drawing.Bitmap]::FromFile((Join-Path $FixtureRoot $entry.Key))
    try {
        $features = @{}; foreach ($name in $regions.Keys) { $features[$name] = Get-Feature $image $regions[$name] }
        $match = $rules | Where-Object { $rule = $_; @($rule.anchors | Where-Object { -not (Test-Anchor $features[$_.r] $_) }).Count -eq 0 } | Sort-Object priority -Descending | Select-Object -First 1
        $actual = if ($null -eq $match) { 'UNKNOWN' } else { $match.screen }
        "{0,-28} expected={1,-12} actual={2,-12}" -f $entry.Key, $entry.Value, $actual
        if ($actual -ne $entry.Value) { $failures += $entry.Key }
    } finally { $image.Dispose() }
}
if ($failures.Count -gt 0) { throw "UI-screen fixture calibration failed: $($failures -join ', ')" }
