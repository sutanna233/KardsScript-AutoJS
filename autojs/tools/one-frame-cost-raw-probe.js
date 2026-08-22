var config = require("../lib/config"), vision = require("../lib/vision");
var out = "/sdcard/AutoJs6/KardsScript/one-frame-cost-raw-probe.json";
auto.waitFor();
if (typeof app !== "undefined" && app.launchPackage) { try { app.launchPackage(config.kardsPackage); sleep(1500); } catch (e) {} }
if (!requestScreenCapture(true)) { files.write(out, JSON.stringify({ error: "capture-permission" })); exit(); }
sleep(5000);
var frame = captureScreen();
while (vision._private.hasBlockingOverlay(frame, config)) { sleep(500); frame = captureScreen(); }
var hand = vision._private.detectHand(frame), result = [];
(hand.cards || []).forEach(function (card, index) {
    var windows = vision._private.cardCostCandidateBounds(card.bounds, index, hand.cards.length);
    result.push({ id: card.id, windows: windows.map(function (bounds) {
        var x = Math.round(bounds[0] * frame.getWidth()), y = Math.round(bounds[1] * frame.getHeight());
        var w = Math.round((bounds[2] - bounds[0]) * frame.getWidth()), h = Math.round((bounds[3] - bounds[1]) * frame.getHeight());
        var words = null;
        try { words = ocr(images.clip(frame, x, y, w, h)); } catch (e) { words = ["ERROR:" + e]; }
        return { x: x, y: y, w: w, h: h, words: words ? Array.prototype.slice.call(words) : null };
    }) });
});
files.write(out, JSON.stringify({ hand: hand.detail, result: result }));
