/*
 * 真实截图回放：用 fixtures/ 里的 KARDS 截图跑完整视觉观察
 * 纯 Node.js 环境（PowerShell 里直接 node 运行），验证视觉识别对真实画面的效果
 *
 * 用法: node autojs/tools/offline-fixture-vision.js [fixtures/xxx.png ...]
 */
var path = require("path");
var config = require("../lib/config");
var vision = require("../lib/vision");
var png = require("./png-decode");

var root = path.join(__dirname, "..", "..");
var fixtures = path.join(root, "fixtures");

// 默认测试一批代表性截图
var defaults = [
    "full-flow-first-our-turn-action.png",
    "play-card-fan-live.png",
    "audit-our-turn.png",
    "full-flow-mulligan-live.png",
    "full-flow-result-after-continue.png",
    "audit-opponent-turn.png"
];
var args = process.argv.slice(2);
var files = args.length ? args : defaults;

files.forEach(function (f) {
    // 兼容: fixtures/xxx.png、xxx.png、绝对路径
    var filePath;
    if (path.isAbsolute(f)) filePath = f;
    else {
        var base = f.split(/[\\/]/).pop();
        filePath = path.join(fixtures, base);
    }
    var frame;
    try {
        frame = png.decodePng(filePath);
    } catch (e) {
        console.log("[跳过] " + f + "  解码失败: " + e.message);
        return;
    }
    var obs = vision.create(config).observe(frame);
    var scene = obs.scene.scene;
    var screen = obs.uiScreen.screen;
    var conf = obs.uiScreen.confidence.toFixed(2);
    var hand = obs.state.hand;
    var units = obs.state.units.filter(function (u) { return u.owner === "PLAYER"; });
    var enemyUnits = obs.state.units.filter(function (u) { return u.owner === "ENEMY"; });

    console.log("=== " + f + " ===");
    console.log("  页面=" + screen + " 场景=" + scene + " 置信度=" + conf + " (" + obs.uiScreen.ruleId + ")");
    console.log("  手牌=" + hand.length + "张 layout=" + obs.state.handConfidence + " 详情=" + obs.evidence.hand);
    if (obs.state.hand.length) {
        console.log("  手牌费用=" + hand.map(function (c) { return c.cost; }).join(",") + " 可出=" +
            hand.filter(function (c) { return c.playable; }).length + "张");
    }
    console.log("  我方单位=" + units.length + " 敌方单位=" + enemyUnits.length +
        " 可操作=" + units.filter(function (u) { return u.canOperate; }).length);
    console.log("  合法目标=" + obs.legalTargets.length + " " +
        obs.legalTargets.map(function (t) { return t.id; }).join(","));
    console.log("  credits=" + obs.evidence.credits + " knownCardCosts=" + obs.evidence.knownCardCosts);
});