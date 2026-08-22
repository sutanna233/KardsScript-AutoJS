/*
 * AutoJS 战场动态驱动测试：持续截屏识别 + 模板匹配定位结束回合按钮 + 点击，
 * 验证动态识图能否跟随回合切换/手牌变化。
 * 运行: adb am start -n org.autojs.autojs6/RunIntentActivity -d file://.../battle-drive.js
 * 结果写 /sdcard/AutoJs6/KardsScript/battle-drive-log.jsonl，最多跑 N 帧后停止。
 */
var config = require("./lib/config");
var vision = require("./lib/vision");

auto.waitFor();
if (!requestScreenCapture(true)) { console.log("BATTLE: 截图权限失败"); exit(); }

function bringKards() {
    try { app.launchPackage("com.android1939.kardsapk"); }
    catch (e) { shell("am start -n com.android1939.kardsapk/com.epicgames.unreal.GameActivity", true); }
    sleep(2000);
}
bringKards();

var LOG = "/sdcard/AutoJs6/KardsScript/battle-drive-log.jsonl";
if (typeof files !== "undefined" && files.exists(LOG)) files.remove(LOG);

var analyzer = vision.create(config);
var frameIndex = 0;
var MAX_FRAMES = 30;          // 最多 30 帧（每帧约 1.5s，约 45s）
var lastActionTime = 0;       // 动作节流

function log(e) {
    var line = JSON.stringify(e);
    try { files.append(LOG, line + "\n"); } catch (err) {}
    console.log("BATTLE: " + line);
}

function templatePath(n) { return "/sdcard/AutoJs6/KardsScript/templates/buttons/" + n; }

function locate(frame, name, threshold) {
    var p = templatePath(name);
    if (typeof files === "undefined" || !files.exists(p)) return null;
    var tmpl = images.read(p);
    try {
        var pt = images.findImage(frame, tmpl, { threshold: threshold || 0.75 });
        if (!pt) return null;
        return { x: pt.x + Math.floor(tmpl.getWidth() / 2), y: pt.y + Math.floor(tmpl.getHeight() / 2) };
    } finally { tmpl.recycle(); }
}
function tap(x, y) { shell("input touchscreen tap " + x + " " + y, true); }

console.log("BATTLE: 开始动态驱动");
while (frameIndex < MAX_FRAMES) {
    var frame = captureScreen();
    frameIndex++;
    if (!frame) { sleep(1000); continue; }
    var obs = analyzer.observe(frame);
    var now = Date.now();

    // 用模板匹配找结束回合(我方/白/对手三种模板)
    var endBtn = locate(frame, "battle-turn-ours.png") ||
                 locate(frame, "battle-turn-ours-white.png") ||
                 locate(frame, "battle-turn-opponent.png");

    var acted = null;
    // 若我方回合且有结束回合按钮,且距上次动作>5s,则点击结束回合
    if ((obs.scene.scene === "OUR_TURN" || obs.scene.scene === "BATTLE") && endBtn && (now - lastActionTime > 5000)) {
        tap(endBtn.x, endBtn.y);
        acted = "end-turn@" + endBtn.x + "," + endBtn.y;
        lastActionTime = now;
    }

    log({
        frame: frameIndex,
        screen: obs.uiScreen.screen,
        scene: obs.scene.scene,
        conf: obs.uiScreen.confidence ? obs.uiScreen.confidence.toFixed(2) : null,
        hand: obs.state.hand.length,
        units: obs.state.units.length,
        targets: obs.legalTargets.length,
        endBtnFound: !!endBtn,
        acted: acted,
        ts: now
    });

    frame.recycle && frame.recycle();
    sleep(1500);
}

log({ frame: frameIndex, done: true });
console.log("BATTLE: DONE 共 " + frameIndex + " 帧");
exit();