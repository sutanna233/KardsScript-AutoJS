/*
 * 点击像素差分验证:点击训练模式(253,342)前后各截帧,计算像素差分,
 * 判断点击是否真的触发了任何画面变化(排除视觉描述滞后)。
 */
var config = require("./lib/config");
var vision = require("./lib/vision");

auto.waitFor();
if (!requestScreenCapture(true)) { console.log("DIFF: 截图权限失败"); exit(); }
function bringKards() {
    try { app.launchPackage("com.android1939.kardsapk"); }
    catch (e) { shell("am start -n com.android1939.kardsapk/com.epicgames.unreal.GameActivity", true); }
    sleep(2000);
}
bringKards();

var LOG = "/sdcard/AutoJs6/KardsScript/diff-log.jsonl";
if (typeof files !== "undefined" && files.exists(LOG)) files.remove(LOG);
function logE(o) { try { files.append(LOG, JSON.stringify(o) + "\n"); } catch (e) {} }

function framePix(frame) {
    var W = frame.getWidth(), H = frame.getHeight();
    var arr = [];
    var step = 16;
    for (var y = 0; y < H; y += step) for (var x = 0; x < W; x += step) arr.push(frame.pixel(x, y) >>> 0);
    return arr;
}
// captureScreen 的 frame 会在下一次捕获时被复用/回收,捕获后必须立即提取像素
function capture() {
    var f = captureScreen();
    if (!f) return null;
    var arr = framePix(f);
    if (f.recycle) f.recycle();
    return arr;
}
function diffPct(a, b) {
    if (a.length !== b.length) return -1;
    var diff = 0, n = a.length;
    for (var i = 0; i < n; i++) {
        var pa = a[i], pb = b[i];
        var ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
        var br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
        if (Math.abs(ar - br) + Math.abs(ag - bg) + Math.abs(ab - bb) > 60) diff++;
    }
    return diff / n;
}

sleep(1000);
var p0 = capture();
logE({ phase: "baseline" });
sleep(500);
var p1 = capture();
var d0 = diffPct(p0, p1);
logE({ phase: "idle-baseline", diffPct: d0.toFixed(4), note: "静止时两帧差异(应≈0)" });

press(253, 342, 80);
sleep(1200);
var p2 = capture();
var d1 = diffPct(p1, p2);
logE({ phase: "after-press-1", diffPct: d1.toFixed(4) });
sleep(1200);
var p3 = capture();
var d2 = diffPct(p2, p3);
logE({ phase: "after-press-2", diffPct: d2.toFixed(4) });

logE({ phase: "done" });
console.log("DIFF: DONE");
exit();