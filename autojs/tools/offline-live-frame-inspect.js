var config = require("../lib/config");
var vision = require("../lib/vision");

var frame = images.read("/sdcard/AutoJs6/KardsScript/fixtures/full-flow-result-after-continue.png");
if (!frame) throw new Error("无法读取完整流程截图");
try {
    var observation = vision.create(config).observe(frame);
    console.log("live-frame=" + observation.uiScreen.screen + "/" + observation.scene.scene + " " + observation.uiScreen.confidence.toFixed(2) + " " + observation.uiScreen.ruleId);
    ["topUi", "menuCenter", "rightPanel", "deckStartButton"].forEach(function (region) {
        console.log(region + "=" + JSON.stringify(vision._private.feature(frame, config.regions[region])));
    });
} finally { frame.recycle(); }

var resultFrame = images.read("/sdcard/AutoJs6/KardsScript/fixtures/full-flow-result-level.png");
try {
    var resultObservation = vision.create(config).observe(resultFrame);
    console.log("result-frame=" + resultObservation.uiScreen.screen + "/" + resultObservation.scene.scene + " " + resultObservation.uiScreen.confidence.toFixed(2) + " " + resultObservation.uiScreen.ruleId);
} finally { resultFrame.recycle(); }

var mulliganFrame = images.read("/sdcard/AutoJs6/KardsScript/fixtures/full-flow-mulligan-live.png");
try {
    var mulliganObservation = vision.create(config).observe(mulliganFrame);
    console.log("mulligan-frame=" + mulliganObservation.uiScreen.screen + "/" + mulliganObservation.scene.scene + " " + mulliganObservation.uiScreen.confidence.toFixed(2) + " " + mulliganObservation.uiScreen.ruleId);
} finally { mulliganFrame.recycle(); }
