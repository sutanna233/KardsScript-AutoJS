// One-frame OCR geometry probe. It never taps and exits after writing a
// single result, so it cannot keep a match idle.
var config = require("../lib/config"), vision = require("../lib/vision");
var out = "/sdcard/AutoJs6/KardsScript/one-frame-cost-probe.json";
auto.waitFor();
if (typeof app !== "undefined" && app.launchPackage) {
    try { app.launchPackage(config.kardsPackage); sleep(4000); } catch (e) {}
}
if (!requestScreenCapture(true)) { files.write(out, JSON.stringify({ error: "capture-permission" })); exit(); }
// AutoJs6 may show a delayed superuser/permission toast after the request;
// let it disappear before measuring the hand fan.
sleep(5000);
var frame = captureScreen();
for (var wait = 0; wait < 12 && vision._private.hasBlockingOverlay(frame, config); wait++) {
    sleep(500);
    frame = captureScreen();
}
var hand = vision._private.detectHand(frame), cards = [];
try { images.save(frame, "/sdcard/AutoJs6/KardsScript/one-frame-cost-probe.png"); } catch (saveError) {}
(hand.cards || []).forEach(function (card, index) {
    var readings = [];
    for (var i = 0; i < 2; i++) readings.push(vision._private.ocrCardCost(frame, card.bounds, index, hand.cards.length));
    cards.push({ id: card.id, bounds: card.bounds, costBounds: card.costBounds, readings: readings });
});
files.write(out, JSON.stringify({ screen: "BATTLE", handConfidence: hand.confidence, detail: hand.detail, cards: cards }));
