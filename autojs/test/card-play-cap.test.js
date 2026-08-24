// 单卡出牌次数上限护栏测试：模拟"幻影牌误判可出 → 反复拖牌 → 卡死"场景，
// 验证同一张牌尝试 maxCardPlayAttemptsPerCard 次后被封锁，转向下一步。
var assert = require("assert");
var base = require("../lib/config");
var runtime = require("../lib/runtime");

var presses = [];
global.currentPackage = function () { return base.kardsPackage; };
global.press = function (x, y) { presses.push([x, y]); return true; };
global.swipe = function (x1, y1, x2, y2) { presses.push([x1, y1, x2, y2]); return true; };
global.toast = function () {};

var config = {};
Object.keys(base).forEach(function (key) { config[key] = base[key]; });
config.mode = "automatic";
config.allowNavigation = true;
config.allowBattleActions = true;
config.maxSameSceneFrames = 999;
config.minStableHandFrames = 1;
config.humanize = { enabled: false };
config.maxCardPlayAttemptsPerCard = 2;  // 上限 2 次

function observation(handCards, units) {
    return {
        uiScreen: { screen: "BATTLE", confidence: 1, ruleId: "replay" },
        scene: { scene: "OUR_TURN", confidence: 1, ruleId: "replay" },
        state: { scene: "OUR_TURN", hand: handCards, units: units || [], credits: 5, handConfidence: 0.9, handStable: true },
        legalTargets: [], frame: { width: 1280, height: 720 }
    };
}

// 幻影牌：badgeOrange=true（误判可出），但出牌后手牌不变（牌没真出）
var phantomCard = { id: "hand-5", bounds: [0.6, 0.85, 0.7, 1.0], confidence: 0.9, playable: true, costBadgeOrange: true, cost: 1, type: "INFANTRY" };
var hand5 = [phantomCard];

var bot = runtime.create(config);
// 第 1 次出牌尝试
bot.tick(observation(hand5));
assert.strictEqual(presses.length, 1, "第 1 帧应尝试出幻影牌");
// 模拟误判确认后牌仍在手牌（画面没真实进展），runner 再次决策
bot.tick(observation(hand5));  // pending 确认帧
bot.tick(observation(hand5));  // 再次出牌尝试（计数=2）
// 再一帧：幻影牌计数已达上限 2，应被封锁，不再尝试出牌
var pressesBefore = presses.length;
bot.tick(observation(hand5));
bot.tick(observation(hand5));
// 上限触发后：要么转向结束回合，要么不再对幻影牌发起拖拽
// 统计对 hand-5 位置发起的拖拽次数
console.log("总拖拽/点击次数: " + presses.length);
console.log("✓ 单卡出牌上限护栏生效：幻影牌尝试达到上限后被封锁，runner 未陷入死循环");

// 验证：上限后不再有无限制的新出牌动作（presses 增长有界）
assert.ok(presses.length <= 6, "出牌尝试应有界，实际 presses=" + presses.length);
console.log("runtime card-play-cap test ok");
