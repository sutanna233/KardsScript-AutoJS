var config = require("./lib/config");
var vision = require("./lib/vision");
var runtime = require("./lib/runtime");

auto.waitFor();
// Auto.js opens the script runner in the foreground.  KARDS owns the
// rendering surface and the capture/input coordinates only make sense while
// its GameActivity is foreground, so hand control back to KARDS before the
// first capture.  This is deliberately a launch (not a force-stop): it keeps
// an existing match/session alive and avoids turning a harmless script start
// into a reconnect.
if (typeof app !== "undefined" && app.launchPackage) {
    try {
        app.launchPackage(config.kardsPackage);
        sleep(1000);
    } catch (launchError) {
        // The loop below will classify the current screen and fail safe if
        // the package cannot be brought forward.
    }
}
// This is intentionally a non-UI script. AutoJs6 keeps this main loop alive
// and permits synchronous screen-capture authorization on its worker thread.
if (!requestScreenCapture(true)) {
    toast("未获得截图权限，已停止");
    exit();
}
// A delayed AutoJs6 permission toast can cover the hand fan immediately
// after capture authorization. Give it a short bounded grace period.
sleep(3500);
var analyzer = vision.create(config);
var bot = runtime.create(config);
// Do not show a startup toast: Auto.js status/permission toasts cover the
// bottom fan and make the first fee/hand observation unusable. The runtime
// records its state in memory and the bounded tools write JSONL when needed.
while (!bot.stopped()) {
    // captureScreen() owns and may reuse this buffer on the next capture. The
    // vision layer only reads it synchronously, so it must not recycle it.
    var frame = captureScreen();
    var observation = analyzer.observe(frame);
    observation.frame = { width: observation.width, height: observation.height };
    bot.tick(observation);
    sleep(config.tickMs);
}
