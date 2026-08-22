// Bounded real-device probe for the hidden hand-card type icon.
// It waits for one OUR_TURN frame, taps exactly one orange-cost card, saves
// before/after screenshots, and exits without dragging or ending the turn.
var base = require("../lib/config");
var vision = require("../lib/vision");
var driverModule = require("../lib/driver");
var config = {};
Object.keys(base).forEach(function (key) { config[key] = base[key]; });
config.mode = "observe";
config.allowNavigation = false;
config.allowBattleActions = true;
config.readCardCosts = false;
config.readHandTypes = true;
config.trustVisualForeground = true;
var out = "/sdcard/AutoJs6/KardsScript/card-lift-probe.jsonl";
files.write(out, "");
function record(item) { files.append(out, JSON.stringify(item) + "\n"); }

if (!requestScreenCapture(true)) { record({ error: "capture-permission" }); exit(); }
sleep(800);
try { app.launchPackage(config.kardsPackage); } catch (launchError) { record({ error: "launch", detail: String(launchError) }); }
sleep(1000);

var analyzer = vision.create(config), driver = driverModule.create(config);
var started = Date.now(), stableKey = "", stableFrames = 0, done = false;
while (Date.now() - started < 120000) {
    var frame = captureScreen(), obs = analyzer.observe(frame);
    var orange = (obs.state.hand || []).filter(function (card) {
        return card.costBadgeOrange === true || (card.costBadge && card.costBadge.orange === true);
    });
    var key = obs.uiScreen.screen + "/" + obs.scene.scene + "/" + (obs.state.hand || []).length + "/" + orange.map(function (card) { return card.id; }).join(",");
    stableFrames = key === stableKey ? stableFrames + 1 : 1;
    stableKey = key;
    record({ t: Date.now() - started, screen: obs.uiScreen.screen, scene: obs.scene.scene,
        handCount: (obs.state.hand || []).length, orangeCards: orange.map(function (card) { return card.id; }), stableFrames: stableFrames });
    if (obs.scene.scene === "OUR_TURN" && orange.length && stableFrames >= 2) {
        var card = orange[0];
        images.save(frame, "/sdcard/AutoJs6/KardsScript/card-lift-before.png", "png", 100);
        var activated = driver.activate(card, { width: obs.width, height: obs.height });
        record({ event: "card-tapped", cardId: card.id, bounds: card.bounds, costBounds: card.costBounds,
            beforeType: card.type || "UNKNOWN", result: activated });
        try { if (frame.recycle) frame.recycle(); } catch (recycleBefore) {}
        sleep(1200);
        var after = captureScreen();
        images.save(after, "/sdcard/AutoJs6/KardsScript/card-lift-after.png", "png", 100);
        var afterObs = analyzer.observe(after);
        record({ event: "after-capture", screen: afterObs.uiScreen.screen, scene: afterObs.scene.scene,
            handCount: (afterObs.state.hand || []).length,
            hand: (afterObs.state.hand || []).map(function (c) { return { id: c.id, type: c.type || "UNKNOWN", bounds: c.bounds }; }) });
        try { if (after.recycle) after.recycle(); } catch (recycleAfter) {}
        done = true;
        break;
    }
    try { if (frame.recycle) frame.recycle(); } catch (recycleFrame) {}
    sleep(250);
}
record({ done: done, elapsed: Date.now() - started });
