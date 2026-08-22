// Bounded navigation-only smoke test.  It enables navigation but explicitly
// keeps battle actions disabled; results are written to JSONL because the
// Auto.js console overlay can obscure the game surface.
var base = require("../lib/config");
var vision = require("../lib/vision");
var runtime = require("../lib/runtime");
var config = {};
Object.keys(base).forEach(function (key) { config[key] = base[key]; });
config.mode = "automatic";
config.allowNavigation = true;
config.allowBattleActions = false;
// Auto.js6 reports its own RunIntentActivity from currentPackage() even after
// KARDS owns the focused Unreal window. This bounded script only sends input
// after a positively classified KARDS frame, so trust that visual foreground.
config.trustVisualForeground = true;
config.maxSameSceneFrames = 80;
var out = "/sdcard/AutoJs6/KardsScript/navigation-test-log.jsonl";
files.write(out, "");
// Capture permission can return Auto.js to the foreground. Request it first,
// then launch KARDS, otherwise the foreground guard rejects every navigation
// input even though screenshots still contain the last KARDS frame.
if (!requestScreenCapture(true)) { files.append(out, JSON.stringify({ error: "capture-permission" }) + "\n"); exit(); }
if (typeof app !== "undefined" && app.launchPackage) {
    try { app.launchPackage(config.kardsPackage); sleep(1000); } catch (e) {}
}
var analyzer = vision.create(config), bot = runtime.create(config);
var started = Date.now();
var endedReason = "timeout";
// Deck detail -> mulligan can include a long Unreal loading/fade interval;
// keep this navigation-only probe bounded, but long enough to observe the
// actual mulligan page instead of reporting a false timeout mid-transition.
while (!bot.stopped() && Date.now() - started < 75000) {
    var frame = captureScreen(), obs = analyzer.observe(frame);
    obs.frame = { width: obs.width, height: obs.height };
    files.append(out, JSON.stringify({ t: Date.now() - started, screen: obs.uiScreen.screen, rule: obs.uiScreen.ruleId, scene: obs.scene.scene, conf: obs.uiScreen.confidence, hand: obs.state.hand.length }) + "\n");
    bot.tick(obs);
    var status = bot.status ? bot.status() : null;
    files.append(out, JSON.stringify({ t: Date.now() - started, actionStatus: status }) + "\n");
    // Stop as soon as a real battle frame is reached.  Keeping a no-op
    // observer alive in OUR_TURN is exactly what causes the game to report
    // inactivity during calibration.
    // Reaching a positively classified BATTLE page is sufficient for this
    // navigation-only probe. Do not keep the session alive just because a
    // transient fade frame has not yet resolved OUR/OPPONENT_TURN.
    if (obs.uiScreen.screen === "BATTLE") {
        endedReason = "battle-reached";
        break;
    }
    sleep(config.tickMs);
}
files.append(out, JSON.stringify({ done: true, stopped: bot.stopped(), reason: endedReason, elapsed: Date.now() - started }) + "\n");
