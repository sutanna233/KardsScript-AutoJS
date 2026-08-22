// Auto.js-native, read-only guard replay over labelled real screenshots.
var base = require("../lib/config");
var vision = require("../lib/vision");
var root = "/sdcard/AutoJs6/KardsScript/fixtures/";
var out = "/sdcard/AutoJs6/KardsScript/guard-fixture-batch.json";
var fixtures = [
    { file: "guard-live-current.png", label: "status-icons-negative" },
    { file: "performance-probe-current-screen.png", label: "normal-battle" },
    { file: "auto-run-after-stop.png", label: "friendly-shield-negative" }
];
var rows = [];
fixtures.forEach(function (fixture) {
    var config = {};
    Object.keys(base).forEach(function (key) { config[key] = base[key]; });
    config.readCardCosts = false;
    config.readHandTypes = false;
    config.readUnitTypes = false;
    var image = images.read(root + fixture.file);
    if (!image) {
        rows.push({ file: fixture.file, label: fixture.label, error: "image-read" });
        return;
    }
    try {
        var started = Date.now();
        var observation = vision.create(config).observe(image);
        rows.push({
            file: fixture.file,
            label: fixture.label,
            elapsedMs: Date.now() - started,
            screen: observation.uiScreen,
            hq: observation.legalTargets.filter(function (target) { return target.kind === "ENEMY_HQ"; }),
            units: observation.state.units,
            guards: observation.evidence.enemyGuardMarkerCount,
            guardTargets: observation.legalTargets.filter(function (target) { return target.isGuard === true; })
        });
    } catch (error) {
        rows.push({ file: fixture.file, label: fixture.label, error: String(error) });
    } finally {
        image.recycle();
    }
});
files.write(out, JSON.stringify(rows, null, 2));
exit();
