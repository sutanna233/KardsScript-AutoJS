// One-frame, no-op hardware probe.  It exits immediately after a capture so
// OCR calibration cannot leave a live KARDS turn idle.
var config = require("../lib/config");
var vision = require("../lib/vision");
var out = "/sdcard/AutoJs6/KardsScript/one-frame-observe.json";
// Mirror the automatic hot path: card affordability comes from the live
// orange badge, while board-unit icon templates remain enabled.
config.readCardCosts = false;
config.readHandTypes = false;
config.readUnitTypes = true;
config.maxUnitTypeMatchesPerFrame = 0;
auto.waitFor();
if (typeof app !== "undefined" && app.launchPackage) {
    try { app.launchPackage(config.kardsPackage); sleep(1500); } catch (e) {}
}
if (!requestScreenCapture(true)) { files.write(out, JSON.stringify({ error: "capture-permission" })); exit(); }
var warmFrame = captureScreen();
var warmTemplatePath = files.join(files.cwd(), "..", config.templates.guardMarkerEnemy);
var warmTemplate = images.read(warmTemplatePath);
var warmStarted = Date.now();
images.findImage(warmFrame, warmTemplate, {
    threshold: 0.999,
    region: [0, 0, warmTemplate.getWidth() + 8, warmTemplate.getHeight() + 8]
});
var warmupMs = Date.now() - warmStarted;
warmTemplate.recycle();
warmFrame.recycle && warmFrame.recycle();
var frame = captureScreen();
var observeStarted = Date.now();
var analyzer = vision.create(config);
var obs = analyzer.observe(frame);
var observeMs = Date.now() - observeStarted;
var secondFrame = captureScreen();
observeStarted = Date.now();
var secondObs = analyzer.observe(secondFrame);
var secondObserveMs = Date.now() - observeStarted;
obs.frame = { width: obs.width, height: obs.height };
files.write(out, JSON.stringify({
    screen: obs.uiScreen,
    scene: obs.scene,
    warmupMs: warmupMs,
    observeMs: observeMs,
    secondObserveMs: secondObserveMs,
    secondScreen: secondObs.uiScreen,
    handConfidence: obs.state.handConfidence,
    credits: obs.state.credits,
    hand: obs.state.hand.map(function (card) { return { id: card.id, bounds: card.bounds, costBounds: card.costBounds, cost: card.cost, playable: card.playable }; }),
    evidence: obs.evidence,
    legalTargets: obs.legalTargets
}));
