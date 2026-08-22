// Read-only Auto.js performance probe. Measures image decode separately from
// first/second constrained findImage calls and never sends input to KARDS.
var config = require("../lib/config");
var out = "/sdcard/AutoJs6/KardsScript/template-performance-probe.json";
if (!requestScreenCapture(true)) {
    files.write(out, JSON.stringify({ error: "capture-permission" }));
    exit();
}
sleep(500);
if (typeof app !== "undefined" && app.launchPackage) {
    try { app.launchPackage(config.kardsPackage); sleep(1000); } catch (e) {}
}
var frame = captureScreen();
var templatePath = files.join(files.cwd(), "..", config.templates.guardMarkerEnemy);
var t0 = Date.now();
var template = images.read(templatePath);
var readMs = Date.now() - t0;
files.write(out, JSON.stringify({ stage: "decoded", readMs: readMs }));
// Match the same small unit-adjacent area used by production, not the full
// enemy board. A broad global search is intentionally excluded.
var bounds = [0.50, 0.05, 0.65, 0.25];
var x = Math.round(frame.getWidth() * bounds[0]);
var y = Math.round(frame.getHeight() * bounds[1]);
var w = Math.round(frame.getWidth() * (bounds[2] - bounds[0]));
var h = Math.round(frame.getHeight() * (bounds[3] - bounds[1]));
var options = { threshold: config.guardTemplateThreshold, region: [x, y, w, h] };
t0 = Date.now();
var first = images.findImage(frame, template, options);
var firstFindMs = Date.now() - t0;
files.write(out, JSON.stringify({ stage: "first-find", readMs: readMs, firstFindMs: firstFindMs,
    first: first ? { x: first.x, y: first.y } : null, region: options.region }));
t0 = Date.now();
var second = images.findImage(frame, template, options);
var secondFindMs = Date.now() - t0;
files.write(out, JSON.stringify({
    readMs: readMs,
    firstFindMs: firstFindMs,
    secondFindMs: secondFindMs,
    first: first ? { x: first.x, y: first.y } : null,
    second: second ? { x: second.x, y: second.y } : null,
    region: options.region
}));
template.recycle();
frame.recycle && frame.recycle();
exit();
