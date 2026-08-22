/*
 * AutoJS 点击方式测试:用 AutoJS 原生 press() 点击训练模式(253,342),
 * 验证是否比裸 adb input touchscreen tap 更有效。
 * 结果写 presstest-log.jsonl
 */
var config = require("./lib/config");
var vision = require("./lib/vision");

auto.waitFor();
if (!requestScreenCapture(true)) { console.log("PRESS: 截图权限失败"); exit(); }

function bringKards() {
    try { app.launchPackage("com.android1939.kardsapk"); }
    catch (e) { shell("am start -n com.android1939.kardsapk/com.epicgames.unreal.GameActivity", true); }
    sleep(2000);
}
bringKards();

var LOG = "/sdcard/AutoJs6/KardsScript/presstest-log.jsonl";
if (typeof files !== "undefined" && files.exists(LOG)) files.remove(LOG);

function logE(o) { try { files.append(LOG, JSON.stringify(o) + "\n"); } catch (e) {} console.log("PRESS: " + JSON.stringify(o)); }

var analyzer = vision.create(config);

function snap(label) {
    sleep(1200);
    var frame = captureScreen();
    var obs = analyzer.observe(frame);
    if (frame && frame.recycle) frame.recycle();
    return obs;
}

// 点击前状态
var before = snap("before");
logE({ phase: "before", label: "before", screen: before.uiScreen.screen, scene: before.scene.scene, ruleId: before.uiScreen.ruleId });

// 方式1: AutoJS 原生 press() 点训练模式(253,342)
var pressOk = null;
try { pressOk = press(253, 342, 80); } catch (e) { pressOk = "err:" + e; }
logE({ phase: "press", method: "press(253,342)", pressOk: pressOk, ts: Date.now() });

// 方式2: AutoJS click()
var clickOk = null;
try { clickOk = click(253, 342); } catch (e) { clickOk = "err:" + e; }
logE({ phase: "click", method: "click(253,342)", clickOk: clickOk, ts: Date.now() });

// 方式3: shell input touchscreen (AutoJS 内)
var shellOk = null;
try { shellOk = shell("input touchscreen tap 253 342", true) && shellOk ? shellOk : true; } catch (e) { shellOk = "err:" + e; }
logE({ phase: "shell", method: "shell input touchscreen", tryed: true, ts: Date.now() });

// 等待并观察最终状态
sleep(3000);
var after = snap("after");
logE({ phase: "after", label: "after-all", screen: after.uiScreen.screen, scene: after.scene.scene, ruleId: after.uiScreen.ruleId });

logE({ phase: "done" });
console.log("PRESS: DONE");
exit();