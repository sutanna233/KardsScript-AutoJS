var config = require("../lib/config"), vision = require("../lib/vision"), out = "/sdcard/AutoJs6/KardsScript/hand-hypothesis-live.json";
auto.waitFor();
var image = images.read("/sdcard/AutoJs6/KardsScript/fixtures/current-auto-attack-result.png");
if (!image) { files.write(out, JSON.stringify({ error: "fixture-missing" })); exit(); }
var detected = vision._private.detectHand(image);
var enriched = vision._private.enrichHandWithFees(image, detected, config);
var result = [{ integrated: true, detected: detected.cards.length, detail: detected.detail, known: enriched.knownCards, costs: detected.cards.map(function (c) { return c.cost; }) }];
for (var n = 5; n <= 9; n++) {
    var boxes = vision._private.handBounds(n, { id: "bottom", top: 590, bottom: 720, rightmost: 902, gap: 145 });
    var costs = boxes.map(function (box, i) { return vision._private.ocrCardCostCandidates(image, box, i, n); });
    result.push({ count: n, costs: costs, known: costs.filter(function (v) { return v != null; }).length });
}
files.write(out, JSON.stringify(result));
image.recycle();
