var config = require("../lib/config"), vision = require("../lib/vision");
var out = "/sdcard/AutoJs6/KardsScript/ocr-fixture-probe.json";
var image = images.read("/sdcard/AutoJs6/KardsScript/fixtures/ocr-fixture.png");
if (!image) { files.write(out, JSON.stringify({ error: "fixture-read" })); exit(); }
var obs = vision.create(config).observe(image);
files.write(out, JSON.stringify({ screen: obs.uiScreen, scene: obs.scene, credits: obs.state.credits, hand: obs.state.hand.map(function(c){return {id:c.id,cost:c.cost,playable:c.playable,costBounds:c.costBounds};}), evidence: obs.evidence })); image.recycle();
