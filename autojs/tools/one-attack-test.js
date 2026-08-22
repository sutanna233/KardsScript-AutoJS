// Bounded attack probe. It deliberately ignores playable cards and only
// exercises the unit-source -> highlighted enemy target handshake.
var base = require("../lib/config"), vision = require("../lib/vision"), runtime = require("../lib/runtime");
var config = {};
Object.keys(base).forEach(function (key) { config[key] = base[key]; });
config.mode = "automatic";
config.allowNavigation = false;
config.allowBattleActions = true;
config.decisionTreePath = "/sdcard/AutoJs6/KardsScript/autojs/strategy/attack-only-test.json";
config.maxSameSceneFrames = 20;
config.endTurnSettleMs = 8000;
var out = "/sdcard/AutoJs6/KardsScript/one-attack-test.jsonl";
files.write(out, "");
auto.waitFor();
if (typeof app !== "undefined" && app.launchPackage) {
    try { app.launchPackage(config.kardsPackage); sleep(1500); } catch (e) {}
}
if (!requestScreenCapture(true)) { files.append(out, JSON.stringify({ error: "capture-permission" }) + "\n"); exit(); }
sleep(6000);
var analyzer = vision.create(config), bot = runtime.create(config), started = Date.now(), selected = false, finished = false;
while (!bot.stopped() && Date.now() - started < 90000) {
    var frame = captureScreen(), obs = analyzer.observe(frame);
    if (obs.uiScreen.ruleId === "blocking-overlay") { sleep(500); continue; }
    obs.frame = { width: obs.width, height: obs.height };
    files.append(out, JSON.stringify({
        t: Date.now() - started,
        screen: obs.uiScreen.screen,
        scene: obs.scene.scene,
        hand: obs.state.hand.length,
        units: obs.state.units,
        legalTargets: obs.legalTargets.map(function (t) { return t.id; }),
        runtime: bot.status ? bot.status() : null
    }) + "\n");
    bot.tick(obs);
    if (!selected && obs.scene.scene === "OUR_TURN" && obs.state.units.some(function (u) { return u.owner === "PLAYER" && u.canOperate; })) {
        selected = true;
        files.append(out, JSON.stringify({ observed: true, reason: "operable-unit-observed", elapsed: Date.now() - started }) + "\n");
    }
    if (selected && obs.scene.scene !== "OUR_TURN") {
        files.append(out, JSON.stringify({ done: true, reason: "turn-transition", elapsed: Date.now() - started }) + "\n");
        finished = true;
        break;
    }
    sleep(config.tickMs);
}
if (!finished) files.append(out, JSON.stringify({ done: true, reason: "timeout", elapsed: Date.now() - started }) + "\n");
