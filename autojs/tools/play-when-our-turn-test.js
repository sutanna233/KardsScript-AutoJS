// Bounded real-turn probe: wait for one positively detected OUR_TURN, then
// let the normal runtime make at most one action and retain before/after
// screenshots. Never guesses a hand source or bypasses runtime safety gates.
var base = require("../lib/config"), vision = require("../lib/vision"), runtime = require("../lib/runtime");
var config = {}; Object.keys(base).forEach(function (k) { config[k] = base[k]; });
config.mode = "automatic"; config.allowNavigation = false; config.allowBattleActions = true;
config.maxSameSceneFrames = 40; config.endTurnSettleMs = 2500;
var out = "/sdcard/AutoJs6/KardsScript/play-when-our-turn-test.jsonl";
files.write(out, ""); auto.waitFor();
if (app && app.launchPackage) { try { app.launchPackage(config.kardsPackage); sleep(1500); } catch (e) {} }
if (!requestScreenCapture(true)) { files.append(out, JSON.stringify({ error: "capture-permission" }) + "\n"); exit(); }
sleep(5000);
var analyzer = vision.create(config), bot = runtime.create(config), started = Date.now(), acted = false, beforeSaved = false;
while (!bot.stopped() && Date.now() - started < 120000) {
    var frame = captureScreen(), obs = analyzer.observe(frame);
    if (obs.uiScreen.ruleId === "blocking-overlay") { sleep(700); continue; }
    obs.frame = { width: obs.width, height: obs.height };
    files.append(out, JSON.stringify({ t: Date.now() - started, screen: obs.uiScreen.screen, rule: obs.uiScreen.ruleId, scene: obs.scene.scene, credits: obs.state.credits, hand: obs.state.hand.length, costs: obs.state.hand.map(function (c) { return c.cost; }), playable: obs.state.hand.filter(function (c) { return c.playable; }).map(function (c) { return c.id; }), units: obs.state.units.length, runtime: bot.status() }) + "\n");
    if (!beforeSaved && obs.scene.scene === "OUR_TURN") { images.save(frame, "/sdcard/AutoJs6/KardsScript/before-auto-play.png", "png", 90); beforeSaved = true; }
    var previous = bot.status(); bot.tick(obs); var current = bot.status();
    if (beforeSaved && !acted && (current.pending || current.last === "已结束回合" || current.playAttempts > previous.playAttempts)) { acted = true; files.append(out, JSON.stringify({ actionObserved: true, elapsed: Date.now() - started, status: current }) + "\n"); }
    if (acted && obs.scene.scene !== "OUR_TURN") { var after = captureScreen(); images.save(after, "/sdcard/AutoJs6/KardsScript/after-auto-play.png", "png", 90); files.append(out, JSON.stringify({ done: true, reason: "turn-transition", elapsed: Date.now() - started }) + "\n"); break; }
    sleep(config.tickMs);
}
if (!acted) files.append(out, JSON.stringify({ done: true, reason: "timeout-no-safe-action", elapsed: Date.now() - started }) + "\n");
