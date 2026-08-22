/* Read-only real-device probe: capture the first player turn containing a
 * friendly unit. It never taps or swipes. */
var config = require("../lib/config");
var vision = require("../lib/vision");
var out = "/sdcard/AutoJs6/KardsScript/unit-action-live-probe.json";
var shot = "/sdcard/AutoJs6/KardsScript/unit-action-live-probe.png";
files.write(out, JSON.stringify({ started: Date.now(), done: false }) + "\n");
if (!requestScreenCapture(true)) {
    files.write(out, JSON.stringify({ done: true, error: "capture-permission" }));
    exit();
}
sleep(900);
try { app.launchPackage(config.kardsPackage); } catch (e) {}
sleep(900);
config.readCardCosts = false;
config.readHandTypes = false;
config.fastPending = true;
var analyzer = vision.create(config), started = Date.now(), found = null;
while (Date.now() - started < 85000) {
    var frame = captureScreen(), observation = analyzer.observe(frame);
    var players = (observation.state.units || []).filter(function (unit) { return unit.owner === "PLAYER"; });
    if (observation.scene.scene === "OUR_TURN" && players.length) {
        images.save(frame, shot, "png", 100);
        found = {
            done: true, elapsed: Date.now() - started,
            screen: observation.uiScreen, scene: observation.scene,
            frontlineOwner: observation.state.frontlineOwner,
            units: players,
            targets: observation.legalTargets || []
        };
        files.write(out, JSON.stringify(found));
        try { frame.recycle(); } catch (e2) {}
        break;
    }
    try { frame.recycle(); } catch (e3) {}
    sleep(500);
}
if (!found) files.write(out, JSON.stringify({ done: true, elapsed: Date.now() - started, reason: "no-player-turn-with-unit" }));
