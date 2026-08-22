var config = require("../lib/config");
var frame = images.read("/sdcard/AutoJs6/KardsScript/fixtures/kards-home-auto-debug.png");
var template = images.read(files.join(files.cwd(), "..", config.templates.trainingUnselected));
var point = images.findImage(frame, template, { threshold: config.templateThreshold, region: [180, 100, 360, 540] });
console.log("template-training-unselected=" + (point ? point.x + "," + point.y : "not-found"));
template.recycle();
frame.recycle();
