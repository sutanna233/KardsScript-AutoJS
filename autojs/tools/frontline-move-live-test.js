/*
 * Bounded real-device regression for rear-unit -> shared-frontline movement.
 * Navigation and ordinary play may establish the board, but the probe exits
 * immediately after the first MOVE_UNIT transaction is confirmed or rejected.
 */
var base = require("../lib/config"), vision = require("../lib/vision"), runtime = require("../lib/runtime");
var config = {};
Object.keys(base).forEach(function (key) { config[key] = base[key]; });
config.mode = "automatic";
config.allowNavigation = true;
config.allowBattleActions = true;
config.maxUnitActionAttemptsPerTurn = 2;
config.maxUnitActionAttemptsPerUnit = 2;
config.readCardCosts = false;
config.readHandTypes = false;
config.readHandRarity = false;
config.readHandFoil = false;
var root = "/sdcard/AutoJs6/KardsScript/";
var out = root + "frontline-move-live-test.jsonl";
var beforePath = root + "frontline-move-live-before.png";
var afterPath = root + "frontline-move-live-after.png";
files.write(out, "");
var currentFrame = null, moveSent = false, moveAction = null, moveGestures = 0, lastStatus = "";
config.actionLogger = function (event) {
    files.append(out, JSON.stringify({ t: Date.now(), event: "driver-action", action: event }) + "\n");
    if (event && event.kind === "MOVE_UNIT") {
        moveGestures++;
        if (!moveSent) {
            moveSent = true;
            moveAction = event;
            try { if (currentFrame) images.save(currentFrame, beforePath); } catch (e) {}
        }
    }
};
auto.waitFor();
try { app.launchPackage(config.kardsPackage); sleep(1500); } catch (e) {}
if (!requestScreenCapture(true)) {
    files.append(out, JSON.stringify({ done: true, result: "capture-permission-denied" }) + "\n");
    exit();
}
sleep(3500);
var analyzer = vision.create(config), bot = runtime.create(config), started = Date.now(), done = false;
while (!bot.stopped() && Date.now() - started < 180000) {
    currentFrame = captureScreen();
    var obs = analyzer.observe(currentFrame);
    obs.frame = { width: obs.width, height: obs.height };
    bot.tick(obs);
    var status = bot.status ? bot.status() : {};
    // Runtime status is the authoritative transaction boundary. Auto.js may
    // swallow an actionLogger callback while its persistent root-input writer
    // is flushing; the pending transition still proves the gesture was sent.
    if (!moveSent && status.pending === "MOVE_TO_FRONTLINE") {
        moveSent = true;
        try { images.save(currentFrame, beforePath); } catch (statusSaveError) {}
    }
    if (status.last !== lastStatus || moveSent) {
        lastStatus = status.last;
        files.append(out, JSON.stringify({
            t: Date.now() - started,
            screen: obs.uiScreen.screen,
            scene: obs.scene.scene,
            frontlineOwner: obs.state.frontlineOwner,
            frontlineY: obs.state.frontlineY,
            playerUnits: (obs.state.units || []).filter(function (u) { return u.owner === "PLAYER"; }),
            status: status
        }) + "\n");
    }
    var moveFinished = status.last === "单位前移已由棋盘位置变化确认" ||
        status.last === "单位动作未被棋盘确认，已暂时封锁该单位";
    if (moveSent && moveFinished) {
        try { images.save(currentFrame, afterPath); } catch (e2) {}
        files.append(out, JSON.stringify({ done: true, result: status.last,
            action: moveAction, moveGestures: moveGestures, elapsed: Date.now() - started }) + "\n");
        done = true;
        break;
    }
    sleep(config.tickMs);
}
if (!done) files.append(out, JSON.stringify({ done: true, result: bot.stopped() ? "runtime-stopped" : "timeout",
    moveSent: moveSent, elapsed: Date.now() - started }) + "\n");
