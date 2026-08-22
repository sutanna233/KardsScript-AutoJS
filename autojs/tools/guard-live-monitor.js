// Read-only bounded monitor. It never clicks or drags.
var base = require("../lib/config"), vision = require("../lib/vision");
var config = {}; Object.keys(base).forEach(function (k) { config[k] = base[k]; });
var out = "/sdcard/AutoJs6/KardsScript/guard-live-monitor.jsonl";
files.write(out, "");
if (typeof app !== "undefined" && app.launchPackage) {
    try { app.launchPackage(config.kardsPackage); sleep(1000); } catch (e) {}
}
if (!requestScreenCapture(true)) { files.append(out, JSON.stringify({ error: "capture-permission" }) + "\n"); exit(); }
var analyzer = vision.create(config), started = Date.now(), limit = 90000, seen = false;
while (Date.now() - started < limit) {
    var frame = captureScreen(), obs = analyzer.observe(frame), guards = obs.evidence && obs.evidence.enemyGuardMarkerCount || 0;
    files.append(out, JSON.stringify({ t: Date.now() - started, screen: obs.uiScreen, scene: obs.scene, guards: guards, units: obs.state.units, targets: obs.legalTargets }) + "\n");
    if (guards > 0) { seen = true; break; }
    sleep(1500);
}
files.append(out, JSON.stringify({ done: true, naturalGuardSeen: seen, durationMs: Date.now() - started }) + "\n");
