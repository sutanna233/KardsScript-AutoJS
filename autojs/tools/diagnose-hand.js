/**
 * 诊断手牌检测问题
 * 运行方式：在 AutoJS 中运行此脚本
 */
var config = require("../lib/config");
var vision = require("../lib/vision");

// 请求截图权限
auto.waitFor();
if (!requestScreenCapture(true)) {
    toast("未获得截图权限");
    exit();
}

toast("开始诊断手牌检测...");
sleep(2000);  // 等待 2 秒，让用户切换到对战画面

var frame = captureScreen();
var analyzer = vision.create(config);
var observation = analyzer.observe(frame);

console.log("=== 手牌检测诊断 ===");
console.log("屏幕尺寸: " + frame.getWidth() + "x" + frame.getHeight());
console.log("UI 页面: " + observation.uiScreen.screen);
console.log("置信度: " + observation.uiScreen.confidence.toFixed(2));
console.log("场景: " + observation.scene.scene);
console.log("手牌数量: " + observation.state.hand.length);
console.log("手牌详情: " + observation.evidence.hand);

if (observation.state.hand.length > 0) {
    console.log("\n=== 手牌位置 ===");
    observation.state.hand.forEach(function(card, index) {
        console.log("卡牌 " + (index + 1) + ":");
        console.log("  ID: " + card.id);
        console.log("  边界: [" + card.bounds.left.toFixed(3) + ", " + card.bounds.top.toFixed(3) + ", " + card.bounds.right.toFixed(3) + ", " + card.bounds.bottom.toFixed(3) + "]");
        console.log("  置信度: " + card.confidence.toFixed(2));
    });
} else {
    console.log("\n未检测到手牌！");
    console.log("可能原因:");
    console.log("1. 当前不在对战画面");
    console.log("2. 手牌检测区域配置错误");
    console.log("3. 手牌检测逻辑有误");
}

console.log("\n=== 单位状态 ===");
observation.state.units.forEach(function(unit, index) {
    console.log("单位 " + (index + 1) + ": " + unit.id + " (" + unit.owner + ")");
});

console.log("\n=== 合法目标 ===");
observation.legalTargets.forEach(function(target, index) {
    console.log("目标 " + (index + 1) + ": " + target.id + " (" + target.kind + ")");
});

// 保存截图以便分析
var path = "/sdcard/AutoJs6/KardsScript/debug/diagnose-" + Date.now() + ".png";
images.save(frame, path);
console.log("\n截图已保存: " + path);

toast("诊断完成，请查看控制台输出");
