var config = require("../lib/config"), vision = require("../lib/vision");
var out = "/sdcard/AutoJs6/KardsScript/result-template-replay.json";
var image = images.read("/sdcard/AutoJs6/KardsScript/fixtures/current-after-result-probe.png");
if (!image) { files.write(out, JSON.stringify({ error: "fixture-read" })); exit(); }
var obs = vision.create(config).observe(image);
files.write(out, JSON.stringify({ screen: obs.uiScreen, scene: obs.scene }));
image.recycle();
