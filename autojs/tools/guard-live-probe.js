// Read-only one-frame guard probe. It never clicks or drags.
var base = require("../lib/config"), vision = require("../lib/vision");
var config = {}; Object.keys(base).forEach(function (k) { config[k] = base[k]; });
var out = "/sdcard/AutoJs6/KardsScript/guard-live-probe.json";
if (!requestScreenCapture(true)) { files.write(out, JSON.stringify({ error: "capture-permission" })); exit(); }
sleep(1200);
var frame = captureScreen(), analyzer = vision.create(config), obs = analyzer.observe(frame);
files.write(out, JSON.stringify({
    screen: obs.uiScreen, scene: obs.scene,
    units: obs.state.units,
    guards: obs.evidence && obs.evidence.enemyGuardMarkerCount,
    targets: obs.legalTargets
}, null, 2));
