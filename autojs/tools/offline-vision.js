var config = require("../lib/config");
var vision = require("../lib/vision");

var path = "/sdcard/AutoJs6/KardsScript/fixtures/kards_current_screen.png";
var frame = images.read(path);
if (!frame) throw new Error("无法读取离线截图: " + path);
var observation = vision.create(config).observe(frame);
console.log("offline-vision " + observation.uiScreen.screen + "/" + observation.scene.scene + " " + observation.uiScreen.confidence.toFixed(2));
console.log("hand=" + observation.state.hand.length + " targets=" + observation.legalTargets.length + " " + observation.evidence.hand);
frame.recycle();
