/*
 * 页面分类诊断：输出真实截图所有锚点区域特征,对照 uiRules 找失败原因
 * 用法: node autojs/tools/diagnose-screen-rules.js [fixtures/xxx.png]
 */
var path = require("path");
var config = require("../lib/config");
var vision = require("../lib/vision");
var png = require("./png-decode");

var root = path.join(__dirname, "..", "..");
var fixtures = path.join(root, "fixtures");
var file = process.argv[2] || "full-flow-first-our-turn-action.png";
// 兼容: 传 fixtures/xxx.png 或 xxx.png 或绝对路径
var filePath = path.isAbsolute(file) ? file : path.join(fixtures, path.basename(file));

var frame = png.decodePng(filePath);
console.log("=== " + file + " 锚点特征 ===");

// 输出所有 region 特征（使用与 classifyScreen 相同的 stride=24）
Object.keys(config.regions).filter(function (k) { return k !== "ocrRegions"; }).forEach(function (name) {
    var f = vision._private.feature(frame, config.regions[name], 24);
    console.log("  " + name + ": L=" + f.L.toFixed(1) + " S=" + f.S.toFixed(1) + " E=" + f.E.toFixed(3));
});

console.log("\n=== 各规则匹配判定 ===");
config.uiRules.forEach(function (rule) {
    var ok = true, details = [];
    rule.anchors.forEach(function (a) {
        var v = vision._private.feature(frame, config.regions[a.r], 24);
        var m = true;
        var parts = [];
        if (a.minL !== undefined) { var t = v.L >= a.minL; m = m && t; parts.push("minL" + a.minL + (t ? "✓" : "✗(" + v.L.toFixed(1) + ")")); }
        if (a.maxL !== undefined) { var t = v.L <= a.maxL; m = m && t; parts.push("maxL" + a.maxL + (t ? "✓" : "✗(" + v.L.toFixed(1) + ")")); }
        if (a.minS !== undefined) { var t = v.S >= a.minS; m = m && t; parts.push("minS" + a.minS + (t ? "✓" : "✗(" + v.S.toFixed(1) + ")")); }
        if (a.maxS !== undefined) { var t = v.S <= a.maxS; m = m && t; parts.push("maxS" + a.maxS + (t ? "✓" : "✗(" + v.S.toFixed(1) + ")")); }
        if (a.minE !== undefined) { var t = v.E >= a.minE; m = m && t; parts.push("minE" + a.minE + (t ? "✓" : "✗(" + v.E.toFixed(3) + ")")); }
        ok = ok && m;
        details.push(a.r + "[" + parts.join(" ") + "]");
    });
    console.log("  " + rule.id + " → " + (ok ? "命中" : "未命中") + "  " + details.join(" | "));
});