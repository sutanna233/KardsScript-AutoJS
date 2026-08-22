var config = require("../lib/config");
var vision = require("../lib/vision");
var frame = images.read("/sdcard/AutoJs6/KardsScript/fixtures/kards_current_screen.png");
console.log("trace begin");
console.log("trace top=" + JSON.stringify(vision._private.feature(frame, config.regions.topUi)));
console.log("trace center=" + JSON.stringify(vision._private.feature(frame, config.regions.menuCenter)));
console.log("trace right=" + JSON.stringify(vision._private.feature(frame, config.regions.rightPanel)));
frame.recycle();
console.log("trace done");
