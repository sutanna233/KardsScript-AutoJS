/* Read-only Auto.js6 probe for native matchTemplate similarity values. */
var base = require("../lib/config"), vision = require("../lib/vision");
var out = "/sdcard/AutoJs6/KardsScript/type-match-live-probe.json";
auto.waitFor();
try { app.launchPackage(base.kardsPackage); sleep(1200); } catch (e) {}
if (!requestScreenCapture(true)) { files.write(out, JSON.stringify({ error: "capture" })); exit(); }
sleep(2500);
// Match auto-main's timed-turn settings; OCR is diagnostic and disabled in
// production because the orange fee badge is authoritative.
base.readCardCosts = false;
var analyzer = vision.create(base), frame = captureScreen(), firstStarted = Date.now(), obs = analyzer.observe(frame);
var firstObserveMs = Date.now() - firstStarted;
var secondFrame = captureScreen(), secondStarted = Date.now(), secondObs = analyzer.observe(secondFrame);
var secondObserveMs = Date.now() - secondStarted;
var unit = (obs.state.units || []).filter(function (u) { return u.owner === "PLAYER" && u.canOperate === true; })[0] ||
    (obs.state.units || []).filter(function (u) { return u.owner === "PLAYER" && u.isFrontline === true; })[0] ||
    (obs.state.units || []).filter(function (u) { return u.owner === "PLAYER"; })[0];
var result = { scene: obs.scene.scene, firstObserveMs: firstObserveMs, secondObserveMs: secondObserveMs,
    secondTypes: (secondObs.state.units || []).filter(function (u) { return u.owner === "PLAYER"; }).map(function (u) {
        return { id: u.id, type: u.type, typeSource: u.typeSource, canOperate: u.canOperate };
    }), units: obs.state.units || [], unit: unit || null, matches: [] };
result.productionTypes = (obs.state.units || []).filter(function (u) { return u.owner === "PLAYER"; }).map(function (u) {
    return { id: u.id, observedType: u.type, typeSource: u.typeSource,
        directType: vision._private.identifyCardType(frame, u.bounds, base) };
});
if (unit) {
    result.productionType = vision._private.identifyCardType(frame, unit.bounds, base);
    var rel = base.typeIconRelativeBounds, b = unit.bounds, w = frame.getWidth(), h = frame.getHeight();
    var regionBounds = [b[0] + (b[2] - b[0]) * rel[0], b[1] + (b[3] - b[1]) * rel[1],
        b[0] + (b[2] - b[0]) * rel[2], b[1] + (b[3] - b[1]) * rel[3]];
    var region = [Math.round(regionBounds[0] * w), Math.round(regionBounds[1] * h),
        Math.round((regionBounds[2] - regionBounds[0]) * w), Math.round((regionBounds[3] - regionBounds[1]) * h)];
    var entries = [];
    [["INFANTRY",base.templates.typeInfantry],["TANK",base.templates.typeTank],
     ["ARTILLERY",base.templates.typeArtillery],["FIGHTER",base.templates.typeFighter],
     ["BOMBER",base.templates.typeBomber]].forEach(function (entry) {
        (Array.isArray(entry[1]) ? entry[1] : [entry[1]]).forEach(function (path) { entries.push([entry[0], path]); });
    });
    entries.forEach(function (entry) {
        var tpl = images.read("/sdcard/AutoJs6/KardsScript/autojs/" + entry[1]), item = { type: entry[0], template: entry[1] };
        try {
            var matched = images.matchTemplate(frame, tpl, { threshold: 0.50, max: 1, region: region });
            item.text = String(matched);
            item.matches = matched && matched.matches ? matched.matches.map(function (m) {
                return { x: m.point.x, y: m.point.y, similarity: m.similarity };
            }) : [];
            if (matched && typeof matched.best === "function") {
                var best = matched.best();
                item.best = best ? { x: best.point.x, y: best.point.y, similarity: best.similarity } : null;
            }
        } catch (error) { item.error = String(error); }
        try { tpl.recycle(); } catch (ignored) {}
        result.matches.push(item);
    });
}
files.write(out, JSON.stringify(result, null, 2));
