// Bounded read-only probe; waits through Auto.js permission toasts.
var config = require("../lib/config"), vision = require("../lib/vision");
var out = "/sdcard/AutoJs6/KardsScript/vision-current-probe.jsonl";
files.write(out, "");
auto.waitFor();
if (!requestScreenCapture(true)) { files.append(out, JSON.stringify({ error: "capture-permission" }) + "\n"); exit(); }
var start = Date.now();
while (Date.now() - start < 20000) {
    var frame = captureScreen();
    var blocked = vision._private.hasBlockingOverlay(frame, config);
    files.append(out, JSON.stringify({ t: Date.now() - start, blocked: blocked }) + "\n");
    if (!blocked) {
        var obs = vision.create(config).observe(frame);
        files.append(out, JSON.stringify({ screen: obs.uiScreen, scene: obs.scene, hand: obs.state.hand.length, legalTargets: obs.legalTargets }) + "\n");
        break;
    }
    sleep(1000);
}
