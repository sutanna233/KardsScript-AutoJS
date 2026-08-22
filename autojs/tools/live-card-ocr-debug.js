// One-frame diagnostic for bottom-fan cost badge geometry. No input actions.
var config = require("../lib/config");
var vision = require("../lib/vision");
var out = "/sdcard/AutoJs6/KardsScript/live-card-ocr-debug.json";
auto.waitFor();
if (!requestScreenCapture(true)) { files.write(out, JSON.stringify({ error: "capture" })); exit(); }
sleep(5000);
var image = captureScreen(), w = image.getWidth(), h = image.getHeight();
function read(bounds) {
    var x = Math.round(bounds[0] * w), y = Math.round(bounds[1] * h);
    var right = Math.round(bounds[2] * w), bottom = Math.round(bounds[3] * h);
    var raw = null, error = null;
    try { raw = ocr(images.clip(image, x, y, right - x, bottom - y)); }
    catch (e) { error = String(e); }
    var values = [];
    if (raw && typeof raw.length === "number") for (var i = 0; i < raw.length; i++) values.push(String(raw[i]));
    return { bounds: bounds, px: [x, y, right, bottom], values: values, error: error };
}
var obs = vision.create(config).observe(image), result = { image: [w, h], scene: obs.scene,
    observedCosts: (obs.state.hand || []).map(function (c) { return c.cost; }), hand: [] };
(obs.state.hand || []).forEach(function (card, i) {
    result.hand.push({ index: i, bounds: card.bounds,
        parsed: vision._private.ocrCardCostCandidates(image, card.bounds, i, obs.state.hand.length),
        windows: vision._private.cardCostCandidateBounds(card.bounds, i, obs.state.hand.length).map(read) });
});
files.write(out, JSON.stringify(result));
