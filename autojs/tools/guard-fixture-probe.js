// Replay a real captured KARDS frame containing enemy/HQ shield markers.
// This is read-only; it validates template scope and target ordering.
var base = require("../lib/config"), vision = require("../lib/vision"), strategy = require("../lib/strategy");
var config = {}; Object.keys(base).forEach(function (k) { config[k] = base[k]; });
var frame = images.read("/sdcard/AutoJs6/KardsScript/fixtures/auto-deploy-y-new.png");
try {
    var obs = vision.create(config).observe(frame);
    var attack = strategy.create(config).chooseTarget(obs.legalTargets, "ATTACK");
    files.write("/sdcard/AutoJs6/KardsScript/guard-fixture-probe.json", JSON.stringify({
        units: obs.state.units, guards: obs.evidence.enemyGuardMarkerCount,
        targets: obs.legalTargets, chosen: attack
    }, null, 2));
} finally { frame.recycle(); }
