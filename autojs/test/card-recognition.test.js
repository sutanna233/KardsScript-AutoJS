var assert = require("assert");
var vision = require("../lib/vision");
var config = require("../lib/config");

// ============ 模拟图像构造器 ============
// 生成区域填充图像：在归一化 bounds 内填充 color，外部填充背景
function regionImage(bounds, color, bgColor) {
    bgColor = bgColor === undefined ? 0xff101820 : bgColor;
    return {
        getWidth: function () { return 1280; },
        getHeight: function () { return 720; },
        pixel: function (x, y) {
            var nx = x / 1280, ny = y / 720;
            var inside = nx >= bounds[0] && nx <= bounds[2] && ny >= bounds[1] && ny <= bounds[3];
            return inside ? color : bgColor;
        }
    };
}

// 生成棋盘格图像（高边缘密度）
function checkerImage(block, colorA, colorB) {
    block = block || 16;
    return {
        getWidth: function () { return 1280; },
        getHeight: function () { return 720; },
        pixel: function (x, y) {
            var cell = Math.floor(x / block) + Math.floor(y / block);
            return cell % 2 === 0 ? colorA : colorB;
        }
    };
}

// 生成半边棋盘图像（中等边缘密度）：左半边棋盘 + 右半边纯色
function halfImage(bounds, checkerColor, flatColor) {
    return {
        getWidth: function () { return 1280; },
        getHeight: function () { return 720; },
        pixel: function (x, y) {
            var nx = x / 1280;
            var inside = nx >= bounds[0] && nx <= bounds[2] && (y / 720) >= bounds[1] && (y / 720) <= bounds[3];
            if (!inside) return 0xff101820;
            var cx = (nx - bounds[0]) / (bounds[2] - bounds[0]);
            if (cx < 0.5) {
                var cell = Math.floor(x / 16) + Math.floor(y / 16);
                return cell % 2 === 0 ? checkerColor : 0xff101010;
            }
            return flatColor;
        }
    };
}

// 工具：打印采样值
function dump(label, image, bounds) {
    var rgb = vision._private.rgbAverage(image, bounds, 12);
    var f = vision._private.feature(image, bounds, 12);
    console.log("  [" + label + "] RGB=(" + (rgb ? rgb.R.toFixed(0) : "null") + "," +
        (rgb ? rgb.G.toFixed(0) : "") + "," + (rgb ? rgb.B.toFixed(0) : "") + ") " +
        "L=" + f.L.toFixed(0) + " S=" + f.S.toFixed(0) + " E=" + f.E.toFixed(2));
}

// 卡牌边界（足够宽，保证采样区域有效）
var CARD = [0.1, 0.4, 0.7, 0.8];
var WIDE = [0.05, 0.35, 0.75, 0.85];
// iconBounds=[0.35,0.55,0.45,0.95] 有效

// ============ 测试 1: 卡牌国家识别（未校准时必须 UNKNOWN） ============
console.log("测试1: 卡牌国家识别（未校准保护）");

// 德国：灰色（R≈G≈B，暗）
assert.strictEqual(vision._private.identifyCardNation(regionImage(CARD, 0xff404040), CARD), "UNKNOWN");
console.log("  灰色样本 → UNKNOWN ✅");

// 苏联：亮红色（R >> G,B，亮）
assert.strictEqual(vision._private.identifyCardNation(regionImage(CARD, 0xffd03030), CARD), "UNKNOWN");
console.log("  红色样本 → UNKNOWN ✅");

// 日本：暗红色（R >> G,B，暗）
assert.strictEqual(vision._private.identifyCardNation(regionImage(CARD, 0xff901818), CARD), "UNKNOWN");
console.log("  暗红样本 → UNKNOWN ✅");

// 美国：亮蓝色（B >> R,G，亮）
assert.strictEqual(vision._private.identifyCardNation(regionImage(CARD, 0xff4080e0), CARD), "UNKNOWN");
console.log("  亮蓝样本 → UNKNOWN ✅");

// 法国：暗蓝色（B >> R,G，暗）
assert.strictEqual(vision._private.identifyCardNation(regionImage(CARD, 0xff203060), CARD), "UNKNOWN");
console.log("  暗蓝样本 → UNKNOWN ✅");

// 英国：棕色（R > G > B）
assert.strictEqual(vision._private.identifyCardNation(regionImage(CARD, 0xff8a6840), CARD), "UNKNOWN");
console.log("  棕色样本 → UNKNOWN ✅");

// 亮灰色 → UNKNOWN（spread<25 但 luma≥70）
assert.strictEqual(vision._private.identifyCardNation(regionImage(CARD, 0xffb0b0b0), CARD), "UNKNOWN");
console.log("  亮灰边框 → UNKNOWN ✅");

// 无效参数
assert.strictEqual(vision._private.identifyCardNation(null, CARD), "UNKNOWN");
console.log("  无效参数 → UNKNOWN ✅");

// ============ 测试 2: 卡牌类型识别（未校准时必须 UNKNOWN） ============
console.log("测试2: 卡牌类型识别（未校准保护）");

// 坦克：高边缘密度 + 较低亮度
var tankCard = checkerImage(8, 0xff606060, 0xff080808);
assert.strictEqual(vision._private.identifyCardType(tankCard, WIDE), "UNKNOWN");
console.log("  高边缘暗色 → UNKNOWN ✅");

// 设施：非常亮 + 几乎无纹理
assert.strictEqual(vision._private.identifyCardType(regionImage(WIDE, 0xffe8e8e8), WIDE), "UNKNOWN");
console.log("  亮平色块 → UNKNOWN ✅");

// 飞机：亮 + 中等纹理（block=64 低对比棋盘，实测 E≈0.09 在 0.08~0.25）
var aircraftCard = checkerImage(64, 0xffd0d0d0, 0xff909090);
assert.strictEqual(vision._private.identifyCardType(aircraftCard, WIDE), "UNKNOWN");
console.log("  亮色中纹理 → UNKNOWN ✅");

// 步兵：中等边缘密度 + 适中亮度（半边棋盘 → E 中等）
var infantryCard = halfImage(WIDE, 0xff605048, 0xffa09888);
assert.strictEqual(vision._private.identifyCardType(infantryCard, WIDE), "UNKNOWN");
console.log("  中边缘中亮度 → UNKNOWN ✅");

// 无效参数
assert.strictEqual(vision._private.identifyCardType(null, WIDE), "UNKNOWN");
console.log("  无效参数 → UNKNOWN ✅");

// ============ 测试 3: 卡牌稀有度识别 ============
console.log("测试3: 卡牌稀有度识别");

// 任意暗色静态外观都不能生成稀有度。
assert.strictEqual(vision._private.identifyCardRarity(regionImage(CARD, 0xff202020), CARD), "UNKNOWN");
console.log("  未校准稀有度样本 → UNKNOWN ✅");

// 任意冷色静态外观都不能生成稀有度。
assert.strictEqual(vision._private.identifyCardRarity(regionImage(CARD, 0xff304070), CARD), "UNKNOWN");
console.log("  未校准蓝色样本 → UNKNOWN ✅");

// 任意暖色静态外观都不能生成稀有度。
assert.strictEqual(vision._private.identifyCardRarity(regionImage(CARD, 0xffd0a040), CARD), "UNKNOWN");
console.log("  未校准金色样本 → UNKNOWN ✅");

// 无效参数
assert.strictEqual(vision._private.identifyCardRarity(null, CARD), "UNKNOWN");
console.log("  无效参数 → UNKNOWN ✅");

// ============ 测试 4: 单位状态检测 ============
console.log("测试4: 单位状态检测");

var slot = [0.41, 0.50, 0.59, 0.64]; // readyBounds=[0.41,0.50,0.59,0.55]

// 可攻击：绿色边框（高饱和度中亮度）
assert.strictEqual(vision._private.detectReadyState(regionImage(slot, 0xff40c040), slot), true);
console.log("  绿色边框 → 可攻击 ✅");

// 无效参数
assert.strictEqual(vision._private.detectReadyState(null, slot), false);
console.log("  无效参数 → false ✅");

// ============ 测试 5: 导出函数完整性 ============
console.log("测试5: 导出函数完整性");

var exported = vision._private;
["detectReadyState", "identifyCard", "identifyCardNation",
 "identifyCardType", "identifyCardRarity", "identifyCardFoil", "ocrCardCost", "ocrHqHealth", "rgbAverage"]
    .forEach(function (name) {
        assert.ok(exported[name], "应导出 " + name);
    });
console.log("  全部导出函数存在 ✅");

// ============ 测试 6: 模板在脚本进程内只解码一次 ============
console.log("测试6: 模板缓存");
var oldFiles = global.files, oldImages = global.images, templateReads = 0, templateMatches = 0;
global.files = {
    cwd: function () { return "/project"; },
    join: function () { return Array.prototype.slice.call(arguments).join("/"); },
    exists: function (path) {
        return path === "templates/types/cache-test-infantry.png" ||
            path === "templates/cards/cache-test-common.png" ||
            path === "templates/cards/cache-test-foil.png" ||
            path === "templates/types/cache-test-tank.png";
    }
};
global.images = {
    read: function (path) {
        templateReads++;
        return { _path: path, getWidth: function () { return 8; }, getHeight: function () { return 8; } };
    },
    findImage: function () { templateMatches++; return { x: 10, y: 10 }; },
    matchTemplate: function (image, template) {
        templateMatches++;
        var similarity = template._path.indexOf("tank") >= 0 ? 0.94 : 0.84;
        var match = { point: { x: 10, y: 10 }, similarity: similarity };
        return { matches: [match], best: function () { return match; } };
    }
};
var cacheConfig = { templates: { typeInfantry: "templates/types/cache-test-infantry.png" }, typeIconThreshold: 0.8 };
assert.strictEqual(vision._private.identifyCardType(regionImage(CARD, 0xff808080), CARD, cacheConfig), "INFANTRY");
assert.strictEqual(vision._private.identifyCardType(regionImage(CARD, 0xff808080), CARD, cacheConfig), "INFANTRY");
assert.strictEqual(templateReads, 1, "同一路径模板不得按单位/帧重复读取解码");
var bestTypeConfig = { templates: {
    typeInfantry: ["templates/types/cache-test-infantry.png"],
    typeTank: ["templates/types/cache-test-tank.png"]
}, typeIconThreshold: 0.8, typeIconCandidateThreshold: 0.7, typeIconMinMargin: 0.035 };
assert.strictEqual(vision._private.identifyCardType(regionImage(CARD, 0xff808080), CARD, bestTypeConfig), "TANK",
    "type recognition must choose the highest native similarity, not the first threshold hit");
templateMatches = 0;
var unitBudget = { remaining: 1 };
var budgetConfig = {
    _activeUnitSlots: [
        { id: "player-a", owner: "PLAYER", bounds: [0.10, 0.20, 0.25, 0.50] },
        { id: "player-b", owner: "PLAYER", bounds: [0.30, 0.20, 0.45, 0.50] }
    ],
    unitSampleStride: 4, minUnitEdgeDensity: 0.01, minPlayerUnitEdgeDensity: 0.01,
    readUnitTypes: true, unknownUnitTypeFallback: "INFANTRY",
    templates: cacheConfig.templates, typeIconThreshold: 0.8
};
var budgetUnits = vision._private.unitState(checkerImage(4, 0xffd0d0d0, 0xff101010), budgetConfig, {}, "UNKNOWN", unitBudget);
assert.strictEqual(budgetUnits.length, 2, "两个已占用单位槽必须保留");
assert.strictEqual(templateMatches, 1, "每帧只能为一个新单位运行类型模板匹配");
assert.strictEqual(unitBudget.remaining, 0, "单位类型帧预算必须被消费一次");
assert.strictEqual(budgetUnits[0].typeSource, "TEMPLATE", "concrete match must be labelled TEMPLATE");
assert.strictEqual(budgetUnits[1].typeSource, "FALLBACK", "unmatched unit must expose that infantry came from fallback");
var movedTypeCache = { "player-rear-left-1": "TANK" };
var movedUnits = vision._private.unitState(checkerImage(4, 0xffd0d0d0, 0xff101010), {
    _activeUnitSlots: [{ id: "player-front-left-1", owner: "PLAYER", bounds: [0.10, 0.20, 0.25, 0.50], isFrontline: true }],
    unitSampleStride: 4, minUnitEdgeDensity: 0.01, minPlayerUnitEdgeDensity: 0.01,
    readUnitTypes: true, unknownUnitTypeFallback: "INFANTRY", templates: {}
}, movedTypeCache, "PLAYER", { remaining: 0, readyOnly: true });
assert.strictEqual(movedUnits[0].type, "TANK", "rear-to-front movement must preserve the concrete cached unit type");
assert.strictEqual(movedUnits[0].typeSource, "MIGRATED", "moved unit must expose that its type came from the rear-slot cache");
assert.strictEqual(movedTypeCache["player-front-left-1"], "TANK", "migrated type must be cached under the new frontline id");
var coexistingTypeCache = { "player-rear-left-1": "INFANTRY" };
var coexistingUnits = vision._private.unitState(checkerImage(4, 0xffd0d0d0, 0xff101010), {
    _activeUnitSlots: [
        { id: "player-rear-left-1", owner: "PLAYER", bounds: [0.10, 0.55, 0.25, 0.80], isFrontline: false },
        { id: "player-front-left-1", owner: "PLAYER", bounds: [0.10, 0.20, 0.25, 0.50], isFrontline: true }
    ], unitSampleStride: 4, minUnitEdgeDensity: 0.01, minPlayerUnitEdgeDensity: 0.01,
    readUnitTypes: true, unknownUnitTypeFallback: "INFANTRY", templates: {}
}, coexistingTypeCache, "PLAYER", { remaining: 0, readyOnly: true });
assert.strictEqual(coexistingUnits.filter(function (u) { return u.id === "player-front-left-1"; })[0].typeSource, "FALLBACK",
    "a distinct frontline card must not inherit the type of a still-present rear card in the same column");

// Rarity and foil are independent runtime switches. Turning on type or one
// appearance field must not trigger the other field's template path.
var appearanceImage = regionImage(CARD, 0xff808080);
var rarityOnlyHand = { layout: "bottom", confidence: 0.9, cards: [
    { id: "hand-1", handIndex: 0, bounds: CARD, costBounds: CARD, confidence: 0.9 }
] };
templateMatches = 0;
vision._private.enrichHandWithFees(appearanceImage, rarityOnlyHand, {
    regions: { playerCredits: [0, 0, 0.1, 0.1] }, readCardCosts: false,
    readHandTypes: false, readHandRarity: true, readHandFoil: false,
    templates: { rarityCommon: "templates/cards/cache-test-common.png", foil: "templates/cards/cache-test-foil.png" },
    rarityRelativeBounds: [0, 0, 1, 1], foilRelativeBounds: [0, 0, 1, 1],
    rarityTemplateThreshold: 0.8, foilTemplateThreshold: 0.8
});
assert.strictEqual(rarityOnlyHand.cards[0].rarity, "COMMON", "rarity switch must populate only rarity");
assert.strictEqual(rarityOnlyHand.cards[0].foil, "UNKNOWN", "disabled foil must remain UNKNOWN even when a foil template exists");
assert.strictEqual(templateMatches, 1, "rarity-only mode must perform exactly one appearance match");

var foilOnlyHand = { layout: "bottom", confidence: 0.9, cards: [
    { id: "hand-1", handIndex: 0, bounds: CARD, costBounds: CARD, confidence: 0.9 }
] };
templateMatches = 0;
vision._private.enrichHandWithFees(appearanceImage, foilOnlyHand, {
    regions: { playerCredits: [0, 0, 0.1, 0.1] }, readCardCosts: false,
    readHandTypes: false, readHandRarity: false, readHandFoil: true,
    templates: { rarityCommon: "templates/cards/cache-test-common.png", foil: "templates/cards/cache-test-foil.png" },
    rarityRelativeBounds: [0, 0, 1, 1], foilRelativeBounds: [0, 0, 1, 1],
    rarityTemplateThreshold: 0.8, foilTemplateThreshold: 0.8
});
assert.strictEqual(foilOnlyHand.cards[0].rarity, "UNKNOWN", "disabled rarity must remain UNKNOWN even when a rarity template exists");
assert.strictEqual(foilOnlyHand.cards[0].foil, "FOIL", "foil switch must populate only foil");
assert.strictEqual(templateMatches, 1, "foil-only mode must perform exactly one appearance match");
global.files = oldFiles;
global.images = oldImages;
console.log("  同一路径连续识别只读取一次；每帧只校准一个新单位 ✅");

// ============ 测试 7: identifyCard 综合识别 ============
console.log("测试7: identifyCard 综合识别");

var compositeCard = regionImage(CARD, 0xffd03030); // 未校准样本
var cardInfo = vision._private.identifyCard(compositeCard, CARD);
assert.strictEqual(cardInfo.nation, "UNKNOWN");
assert.ok(cardInfo.bounds, "应包含边界信息");
assert.strictEqual(typeof cardInfo.type, "string");
assert.strictEqual(typeof cardInfo.rarity, "string");
assert.strictEqual(typeof cardInfo.foil, "string");
console.log("  综合识别: 未校准字段均保持 UNKNOWN ✅");

console.log("\n=== 卡牌识别与单位状态测试全部通过 ===");
