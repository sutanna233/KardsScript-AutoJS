// Bounded action probe: at most one planning tick is allowed to issue a
// battle action, then the script exits after observing the transition.  This
// is intentionally separate from main.js so calibration never runs forever.
var base = require("../lib/config"), vision = require("../lib/vision"), runtime = require("../lib/runtime");
var config = {};
Object.keys(base).forEach(function (key) { config[key] = base[key]; });
config.mode = "automatic";
config.allowNavigation = false;
config.allowBattleActions = true;
config.endTurnSettleMs = 2500;
config.maxSameSceneFrames = 20;
// Keep the same two-frame hand settling policy as the real runtime. A single
// post-launch frame can briefly report one card while the fan still animates;
// allowing an action from that frame is not a safe one-action probe.
config.minStableHandFrames = 2;
var out = "/sdcard/AutoJs6/KardsScript/one-turn-action-test.jsonl";
files.write(out, "");
auto.waitFor();
if (typeof app !== "undefined" && app.launchPackage) {
    try { app.launchPackage(config.kardsPackage); sleep(1500); } catch (e) {}
}
if (!requestScreenCapture(true)) { files.append(out, JSON.stringify({ error: "capture-permission" }) + "\n"); exit(); }
// Reconnect recovery can leave the Auto.js capture/status surface visible for
// several seconds. Wait a bounded interval before treating those frames as a
// battle observation; otherwise the whole short probe is consumed by the
// overlay guard and produces no evidence.
sleep(6000);
var analyzer = vision.create(config), bot = runtime.create(config), started = Date.now();
var finished = false, observedOurTurn = false, initialHand = null;
// Allow one post-drag redraw/settle cycle to be observed. The first real
// deployment can take several seconds after capture permission and a short
// 12s window used to end just before the new unit appeared.
while (!bot.stopped() && Date.now() - started < 40000) {
    var frame = captureScreen(), obs = analyzer.observe(frame);
    if (obs.uiScreen.ruleId === "blocking-overlay") { sleep(500); continue; }
    obs.frame = { width: obs.width, height: obs.height };
    files.append(out, JSON.stringify({
        t: Date.now() - started,
        screen: obs.uiScreen.screen,
        rule: obs.uiScreen.ruleId,
        scene: obs.scene.scene,
        credits: obs.state.credits,
        hand: obs.state.hand.length,
        costs: obs.state.hand.map(function (c) { return c.cost; }),
        playable: obs.state.hand.filter(function (c) { return c.playable; }).map(function (c) { return c.id; }),
        units: obs.state.units.length,
        runtime: bot.status ? bot.status() : null
    }) + "\n");
    bot.tick(obs);
    if (obs.uiScreen.screen === "BATTLE" && obs.scene.scene === "OUR_TURN" && obs.state.handConfidence >= 0.7 && obs.state.credits != null) {
        // Seeing a stable OUR_TURN frame does not prove that a drag or tap
        // was accepted.  The runtime may still be waiting for OCR/target
        // confirmation, or may have safely ended the turn.  Keep the probe's
        // result truthful; the screenshots and per-frame log are the action
        // evidence until a post-action state transition is observed.
        if (!observedOurTurn) {
            observedOurTurn = true;
            initialHand = obs.state.hand.length;
            files.append(out, JSON.stringify({ observed: true, reason: "stable-our-turn-observed", elapsed: Date.now() - started }) + "\n");
        }
    } else if (observedOurTurn && (obs.scene.scene !== "OUR_TURN" || obs.state.hand.length < initialHand)) {
        files.append(out, JSON.stringify({ done: true, stopped: bot.stopped(), reason: "post-action-state-transition", elapsed: Date.now() - started }) + "\n");
        finished = true;
        break;
    }
    sleep(config.tickMs);
}
if (!finished) files.append(out, JSON.stringify({ done: true, stopped: bot.stopped(), reason: "timeout", elapsed: Date.now() - started }) + "\n");
