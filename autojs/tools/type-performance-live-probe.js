/* Read-only two-frame timing using the exact auto-main hot-path settings. */
var base = require("../lib/config"), vision = require("../lib/vision");
var out = "/sdcard/AutoJs6/KardsScript/type-performance-live-probe.json";
auto.waitFor();
try { app.launchPackage(base.kardsPackage); sleep(1200); } catch (e) {}
if (!requestScreenCapture(true)) { files.write(out, JSON.stringify({ error: "capture" })); exit(); }
sleep(2500);
base.readCardCosts = false;
base.readHandTypes = false;
base.readHandRarity = false;
base.readHandFoil = false;
var analyzer = vision.create(base);
var firstFrame = captureScreen(), firstStarted = Date.now(), first = analyzer.observe(firstFrame), firstMs = Date.now() - firstStarted;
var secondFrame = captureScreen(), secondStarted = Date.now(), second = analyzer.observe(secondFrame), secondMs = Date.now() - secondStarted;
files.write(out, JSON.stringify({ firstMs: firstMs, secondMs: secondMs,
    firstTypes: (first.state.units || []).filter(function (u) { return u.owner === "PLAYER"; }).map(function (u) {
        return { id: u.id, type: u.type, typeSource: u.typeSource, canOperate: u.canOperate };
    }),
    secondTypes: (second.state.units || []).filter(function (u) { return u.owner === "PLAYER"; }).map(function (u) {
        return { id: u.id, type: u.type, typeSource: u.typeSource, canOperate: u.canOperate };
    })
}, null, 2));
