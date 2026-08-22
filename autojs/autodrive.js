/*
 * AutoJS 动态驱动测试：用模板匹配定位按钮 + input touchscreen tap 实际点击，
 * 分阶段导航 KARDS（模式菜单→主菜单→开始→训练模式→选卡组→进入对局），
 * 每步将"识别结果+模板匹配+采取的操作"追加写入 /sdcard/AutoJs6/KardsScript/autodrive-log.jsonl。
 * 运行: adb am start -n org.autojs.autojs6/RunIntentActivity -d file://.../autodrive.js
 */
var config = require("./lib/config");
var vision = require("./lib/vision");

auto.waitFor();
if (!requestScreenCapture(true)) { console.log("AUTODRIVE: 截图权限失败"); exit(); }

// 关键：AutoJS 启动脚本会抢占前台。显式把 KARDS 拉回前台，
// 否则 captureScreen 截到的是桌面/AutoJS，导致识别失败。
function bringKards() {
    try { app.launchPackage("com.android1939.kardsapk"); } 
    catch (e) { try { app.launch("com.android1939.kardsapk"); } catch (e2) { shell("am start -n com.android1939.kardsapk/com.epicgames.unreal.GameActivity", true); } }
    sleep(2000);
}
bringKards();

var LOG = "/sdcard/AutoJs6/KardsScript/autodrive-log.jsonl";
if (typeof files !== "undefined" && files.exists(LOG)) files.remove(LOG);

var analyzer = vision.create(config);
var seen = {}; // 防重复动作的节流

function log(entry) {
    var line = JSON.stringify(entry);
    console.log("AUTODRIVE: " + line);
    try { files.append(LOG, line + "\n"); } catch (e) { console.log("AUTODRIVE: 写日志失败 " + e); }
}

// 模板路径解析（相对 autojs/templates/buttons）
function templatePath(name) {
    return "/sdcard/AutoJs6/KardsScript/templates/buttons/" + name;
}

// 用 images.findImage 在整个画面找模板,返回中心点;找不到返回 null
function locate(frame, templateName, threshold) {
    var path = templatePath(templateName);
    // AutoJS6 的 images 模块无 exists();用 files.exists 检查文件
    if (typeof files === "undefined" || !files.exists(path)) return null;
    var tmpl = images.read(path);
    try {
        var pt = images.findImage(frame, tmpl, { threshold: threshold || 0.8 });
        if (!pt) return null;
        return {
            x: pt.x + Math.floor(tmpl.getWidth() / 2),
            y: pt.y + Math.floor(tmpl.getHeight() / 2)
        };
    } finally { tmpl.recycle(); }
}

function tap(x, y) {
    shell("input touchscreen tap " + x + " " + y, true);
}

// 短等待让游戏 UI 更新
function pause(ms) { ms = ms || 1200; var t0 = Date.now(); while (Date.now() - t0 < ms) sleep(50); }

var step = 0;
function snapshot(label) {
    sleep(900);
    var frame = captureScreen();
    if (!frame) { log({ step: step, label: label, error: "capture fail" }); return null; }
    var obs = analyzer.observe(frame);
    step++;
    return { frame: frame, obs: obs };
}

// 主流程: 一条简洁的导航链
// 阶段 A: 若在 MODE_MENU/竞技场,按返回回到主菜单
var s = snapshot("stage-A-initial");
log({ step: step, label: "initial", screen: s && s.obs.uiScreen.screen, scene: s && s.obs.scene.scene, ruleId: s && s.obs.uiScreen.ruleId });
if (s) {
    if (s.obs.uiScreen.screen !== "HOME" && s.obs.uiScreen.screen !== "UNKNOWN") {
        // 在子菜单(如竞技场),按返回回主菜单。仅当确实是 KARDS 界面才按。
        var backCount = 0;
        while (backCount < 3) {
            shell("input keyevent KEYCODE_BACK", true);
            pause(900);
            var check = captureScreen();
            var c = analyzer.observe(check);
            log({ step: step, label: "back-iter", n: backCount, screen: c.uiScreen.screen });
            if (c.uiScreen.screen === "HOME" || c.scene.scene === "MENU") break;
            if (check && check.recycle) check.recycle();
            backCount++;
        }
    } else {
        log({ step: step, label: "already-home", screen: s.obs.uiScreen.screen });
    }
    // 阶段 B: 在主菜单,用模板匹配点"开始"
    var frame = captureScreen();
    var startBtn = locate(frame, "home-start.png");
    log({ step: step, label: "locate-start", found: !!startBtn, at: startBtn });
    if (startBtn) { tap(startBtn.x, startBtn.y); pause(1500); }
    frame.recycle && frame.recycle();

    // 阶段 C: 模式菜单,点"训练模式"
    frame = captureScreen();
    var trainBtn = locate(frame, "mode-training-unselected.png") || locate(frame, "mode-training-selected.png");
    log({ step: step, label: "locate-training", found: !!trainBtn, at: trainBtn });
    if (trainBtn) { tap(trainBtn.x, trainBtn.y); pause(1800); }
    frame.recycle && frame.recycle();

    // 阶段 D: 训练卡组列表,点第一个卡组
    frame = captureScreen();
    var obsNow = analyzer.observe(frame);
    log({ step: step, label: "training-deck-screen", screen: obsNow.uiScreen.screen, scene: obsNow.scene.scene });
    frame.recycle && frame.recycle();
}

log({ step: step, label: "end", done: true });
console.log("AUTODRIVE: DONE");
exit();