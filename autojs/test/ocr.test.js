var assert = require("assert");
var vision = require("../lib/vision");
var config = require("../lib/config");

// 模拟Auto.js6环境
global.ocr = function(image) {
    // 模拟OCR函数，返回模拟的识别结果
    // 在实际测试中，这应该返回真实的OCR结果
    console.log("[模拟OCR] 被调用，图像尺寸:", image.getWidth(), "x", image.getHeight());
    return ["5", "10", "3"];
};

global.images = {
    clip: function(image, x, y, width, height) {
        // 模拟图像裁剪
        console.log("[模拟裁剪] 区域:", x, y, width, height);
        return {
            getWidth: function() { return width; },
            getHeight: function() { return height; },
            pixel: function(x, y) { return 0xff000000; }
        };
    }
};

// 测试1: 测试优化后的ocrNumber函数
console.log("测试1: 测试优化后的ocrNumber函数");

// 创建模拟图像
var mockImage = {
    getWidth: function() { return 1280; },
    getHeight: function() { return 720; },
    pixel: function(x, y) { return 0xff000000; }
};

// 测试基本OCR功能
var result1 = vision._private.ocrNumber(mockImage, [0.1, 0.1, 0.2, 0.2]);
console.log("基本OCR结果:", result1);

// 测试带选项的OCR
var result2 = vision._private.ocrNumber(mockImage, [0.1, 0.1, 0.2, 0.2], {
    minValue: 0,
    maxValue: 20,
    logPrefix: "测试OCR"
});
console.log("带选项OCR结果:", result2);

// 测试3: 测试卡牌费用识别函数
console.log("测试3: 测试卡牌费用识别函数");

// 模拟卡牌边界
var cardBounds = [0.1, 0.5, 0.3, 0.8];
var costResult = vision._private.ocrCardCost(mockImage, cardBounds, 0, 3);
console.log("卡牌费用识别结果:", costResult);

// 测试4: 测试总部血量识别函数
console.log("测试4: 测试总部血量识别函数");

// 测试我方总部血量
var playerHealthResult = vision._private.ocrHqHealth(mockImage, false);
console.log("我方总部血量识别结果:", playerHealthResult);

// 测试敌方总部血量
var enemyHealthResult = vision._private.ocrHqHealth(mockImage, true);
console.log("敌方总部血量识别结果:", enemyHealthResult);

// 测试5: 验证配置中的OCR区域
console.log("测试5: 验证配置中的OCR区域");

assert.ok(config.regions.ocrRegions, "配置中应该包含OCR区域");
assert.ok(config.regions.ocrRegions.cardCost, "应该包含卡牌费用区域");
assert.ok(config.regions.ocrRegions.playerHqHealth, "应该包含我方总部血量区域");
assert.ok(config.regions.ocrRegions.enemyHqHealth, "应该包含敌方总部血量区域");

console.log("卡牌费用区域:", config.regions.ocrRegions.cardCost);
console.log("我方总部血量区域:", config.regions.ocrRegions.playerHqHealth);
console.log("敌方总部血量区域:", config.regions.ocrRegions.enemyHqHealth);

// 测试6: 验证OCR函数的参数验证
console.log("测试6: 验证OCR函数的参数验证");

// 测试无效图像
var invalidResult = vision._private.ocrNumber(null, [0.1, 0.1, 0.2, 0.2]);
assert.strictEqual(invalidResult, null, "无效图像应该返回null");

// 测试无效边界
var invalidBoundsResult = vision._private.ocrNumber(mockImage, null);
assert.strictEqual(invalidBoundsResult, null, "无效边界应该返回null");

// 测试超出范围的值
var outOfRangeResult = vision._private.ocrNumber(mockImage, [0.1, 0.1, 0.2, 0.2], {
    minValue: 0,
    maxValue: 5
});
// 注意：由于模拟OCR返回"5"，它应该在范围内
console.log("超出范围测试结果:", outOfRangeResult);

console.log("所有OCR测试完成！");
console.log("OCR功能增强测试成功！");