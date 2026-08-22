/*
 * 模板匹配单元测试：用真实截图验证 node-match 能精确定位按钮
 * 用法: node autojs/test/template-match.test.js
 */
var assert = require("assert");
var path = require("path");
var png = require("../tools/png-decode");
var m = require("../tools/node-match");

var root = path.join(__dirname, "..", "..");
var fixtures = path.join(root, "fixtures");
var buttons = path.join(root, "autojs", "templates", "buttons");

function matchOn(imgName, tmplName, threshold) {
    var img = png.decodePng(path.join(fixtures, imgName));
    var t = png.decodePng(path.join(buttons, tmplName));
    return m.matchTemplate(img, t, threshold);
}

// 测试1: 同图自一致 —— 模板在原位置应 sim≈1.0
console.log("测试1: start-button 在主菜单 (期望 ~ (8,159))");
var r1 = matchOn("live-home.png", "start-button.png", 0.9);
assert.ok(r1.ok, "start-button 应命中");
assert.ok(Math.abs(r1.x - 8) <= 3, "x 应在 8 附近, got " + r1.x);
assert.ok(Math.abs(r1.y - 159) <= 3, "y 应在 159 附近, got " + r1.y);
assert.ok(r1.similarity > 0.95, "相似度应 > 0.95, got " + r1.similarity);
console.log("  → sim=" + r1.similarity.toFixed(3) + " pos=(" + r1.x + "," + r1.y + ") ✅");

// 测试2: home-start 模板在真实主菜单定位开始按钮
console.log("测试2: home-start 在主菜单");
var r2 = matchOn("live-home.png", "home-start.png", 0.8);
assert.ok(r2.ok, "home-start 应命中");
assert.ok(Math.abs(r2.x - 40) <= 5 && Math.abs(r2.y - 205) <= 5, "应在(40,205), got (" + r2.x + "," + r2.y + ")");
console.log("  → sim=" + r2.similarity.toFixed(3) + " pos=(" + r2.x + "," + r2.y + ") ✅");

// 测试3: 结束回合按钮(当前UI模板)在战场右下角
console.log("测试3: battle-turn-ours(当前版) 在战场右下角");
var r3 = matchOn("play-card-fan-live.png", "battle-turn-ours.png", 0.8);
assert.ok(r3.ok, "battle-turn-ours 应命中");
assert.ok(Math.abs(r3.x - 820) <= 10 && Math.abs(r3.y - 660) <= 10, "应在右下(820,660), got (" + r3.x + "," + r3.y + ")");
console.log("  → sim=" + r3.similarity.toFixed(3) + " pos=(" + r3.x + "," + r3.y + ") ✅");

// 测试4: 模板匹配依赖页面上下文 —— 跨页面可能误匹配相似UI。
// 记录:home-start 模板在战场会误匹配到 (374,237) 的相似卡片区域(sim>0.9)。
// 这正是项目"先判定页面、再在页面内做按钮匹配"设计的原因。
console.log("测试4: 记录跨页面误匹配现象(模板需配合页面上下文使用)");
var r4 = matchOn("play-card-fan-live.png", "home-start.png", 0.8);
console.log("  → home-start 在战场截图 sim=" + r4.similarity.toFixed(3) +
    " pos=(" + r4.x + "," + r4.y + ") (相似卡片区域,需页面上下文区分)");
// 不失败：这只是记录局限。关键断言是页面内定位精确(测试1/2/3已验证)

// 测试5: mode-training-unselected 模板在开始后界面匹配训练模式
console.log("测试5: mode-training-unselected 在开始后界面");
var r5 = matchOn("live-after-start.png", "mode-training-unselected.png", 0.8);
assert.ok(r5.ok, "mode-training 应命中");
console.log("  → sim=" + r5.similarity.toFixed(3) + " pos=(" + r5.x + "," + r5.y + ") ✅");

// 测试6: 当前促销弹窗关闭 X 只在实机弹窗右上角命中
console.log("测试6: popup-close-promo-current 在促销弹窗");
var r6 = matchOn("guard-short-live-current.png", "popup-close-promo-current.png", 0.90);
assert.ok(r6.ok, "促销弹窗关闭 X 应命中");
assert.ok(Math.abs(r6.x - 1158) <= 2 && Math.abs(r6.y - 101) <= 2,
    "关闭 X 应位于 (1158,101), got (" + r6.x + "," + r6.y + ")");
console.log("  → sim=" + r6.similarity.toFixed(3) + " pos=(" + r6.x + "," + r6.y + ") ✅");

console.log("\n=== 模板匹配全部通过 ===");
