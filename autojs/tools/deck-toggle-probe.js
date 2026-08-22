// 验证 detectDeckModeToggle 在当前 DECK_DETAIL 页面上的识别结果。
// 预期：当前"排位"已选中（金色高亮），应返回 "ranked"。
var config = require("/sdcard/AutoJs6/KardsScript/autojs/lib/config.js");
var vision = require("/sdcard/AutoJs6/KardsScript/autojs/lib/vision.js");

auto.waitFor();
if (!requestScreenCapture(true)) { files.write("/sdcard/AutoJs6/KardsScript/deck-toggle-probe.json", JSON.stringify({ error: "no-capture" })); exit(); }
sleep(2500);
app.launchPackage("com.android1939.kardsapk");
sleep(1500);

var frame = captureScreen();
var result = vision._private.detectDeckModeToggle(frame, config);
var analyzer = vision.create(config);
var obs = analyzer.observe(frame);

files.write("/sdcard/AutoJs6/KardsScript/deck-toggle-probe.json", JSON.stringify({
    directCall: result,
    observedToggle: obs.state.deckModeToggle,
    screen: obs.uiScreen.screen,
    ruleId: obs.uiScreen.ruleId,
    confidence: obs.uiScreen.confidence
}));
log("deck-toggle-probe: " + result + " / " + obs.state.deckModeToggle);
