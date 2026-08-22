var config = require("../lib/config");
var vision = require("../lib/vision");
var frame = images.read("/sdcard/AutoJs6/KardsScript/fixtures/kards-menu-debug.png");
var observation = vision.create(config).observe(frame);
console.log("offline-battle " + observation.uiScreen.screen + "/" + observation.scene.scene + " " + observation.uiScreen.confidence.toFixed(2));
frame.recycle();
