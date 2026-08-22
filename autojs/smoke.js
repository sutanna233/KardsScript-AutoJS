/*
 * AutoJS 环境冒烟测试：验证截图 + vision 观察 + 真实 images.findImage 模板匹配
 * 通过 adb intent 在 AutoJS6 里运行，结果由 console.log 输出到 logcat。
 * 本脚本只识别不操作，安全。
 */
var config = require("./lib/config");
var vision = require("./lib/vision");

auto.waitFor();
if (!requestScreenCapture(true)) {
    console.log("SMOKE: 截图权限获取失败");
    exit();
}

console.log("SMOKE: 开始冒烟测试");
var frame = captureScreen();
if (!frame) {
    console.log("SMOKE: captureScreen 返回空");
    exit();
}

// 1. vision 观察（页面/场景/手牌/单位）
var analyzer = vision.create(config);
var obs = analyzer.observe(frame);
console.log("SMOKE: screen=" + obs.uiScreen.screen + " scene=" + obs.scene.scene +
    " conf=" + obs.uiScreen.confidence.toFixed(2) + " (" + obs.uiScreen.ruleId + ")");
console.log("SMOKE: hand=" + obs.state.hand.length + " units=" + obs.state.units.length +
    " targets=" + obs.legalTargets.length);

// 2. 真实 images.findImage 模板匹配（AutoJS 环境）
var templates = config.templates || {};
var matchResults = {};

function tryFindImage(key, path, region) {
    if (!path) return;
    var resolved = null;
    var candidates = [path, "templates/buttons/" + path.split("/").pop()];
    for (var i = 0; i < candidates.length; i++) {
        var p = candidates[i];
        if (typeof files !== "undefined" && files.exists(p)) { resolved = p; break; }
        if (images.exists(p)) { resolved = p; break; }
    }
    if (!resolved) { matchResults[key] = "template missing"; return; }
    var tmpl = images.read(resolved);
    try {
        // 搜索区域必须能容纳模板尺寸。结束回合按钮用右下区域;
        // 其余(换牌/结算)用全图,避免"宽度超限"。
        var opts = { threshold: config.templateThreshold };
        if (region) opts.region = region;
        var pt = images.findImage(frame, tmpl, opts);
        matchResults[key] = pt ? ("found@" + pt.x + "," + pt.y) : "notfound";
    } finally { tmpl.recycle(); }
}

// 结束回合按钮在右下 [0.64,0.90]-[0.76,1.00]，区域足够容纳模板(190x55)
var w = frame.getWidth(), h = frame.getHeight();
tryFindImage("battle-turn-ours", templates.battleOurTurn,
    [Math.round(w * 0.60), Math.round(h * 0.86), Math.round(w * 0.24), Math.round(h * 0.14)]);
tryFindImage("mulligan-header", templates.mulliganHeader);   // 全图
tryFindImage("result-next", templates.resultNextReward);     // 全图
console.log("SMOKE: match=" + JSON.stringify(matchResults));

// 3. 与主菜单模板之一对比（验证当前是否主菜单）
var frameW = frame.getWidth(), frameH = frame.getHeight();
console.log("SMOKE: frame=" + frameW + "x" + frameH);
console.log("SMOKE: DONE");

// 结果同时写入文件，确保 Windows 端一定能读到
try {
    var logPath = "/sdcard/AutoJs6/KardsScript/smoke-result.json";
    var payload = JSON.stringify({
        screen: obs.uiScreen.screen, scene: obs.scene.scene,
        conf: obs.uiScreen.confidence, ruleId: obs.uiScreen.ruleId,
        hand: obs.state.hand.length, units: obs.state.units.length,
        targets: obs.legalTargets.length, match: matchResults, frame: frameW + "x" + frameH
    });
    files.write(logPath, payload);
    console.log("SMOKE: 结果已写入 " + logPath);
} catch (e) {
    console.log("SMOKE: 写文件失败 " + e);
}
frame.recycle && frame.recycle();
exit();