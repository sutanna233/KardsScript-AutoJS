/* Native Auto.js6 replay of three user-visible unit icons from one real frame. */
var config = require("../lib/config"), vision = require("../lib/vision");
var root = "/sdcard/AutoJs6/KardsScript/";
var image = images.read(root + "fixtures/type-match-current-screen.png");
var cases = [
    { id: "rear-infantry", expected: "INFANTRY", bounds: [0.457, 0.60, 0.543, 0.82] },
    { id: "rear-tank", expected: "TANK", bounds: [0.342, 0.60, 0.428, 0.82] },
    { id: "front-tank", expected: "TANK", bounds: [0.457, 0.36, 0.543, 0.59] }
];
var started = Date.now();
cases.forEach(function (item) { item.actual = vision._private.identifyCardType(image, item.bounds, config); });
files.write(root + "type-fixture-native-probe.json", JSON.stringify({ elapsedMs: Date.now() - started, cases: cases }, null, 2));
try { image.recycle(); } catch (ignored) {}
