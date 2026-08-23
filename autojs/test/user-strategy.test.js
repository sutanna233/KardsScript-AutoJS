var assert = require("assert");
var userStrategy = require("../lib/user-strategy");

var defaults = userStrategy.normalize({});
assert.deepStrictEqual(defaults.actionOrder, ["OPERATE_UNIT", "PLAY_CARD", "END_TURN"]);
assert.strictEqual(defaults.preferFrontlineUnits, true);
assert.strictEqual(defaults.modeType, "training");
assert.strictEqual(defaults.cardPlayPaceMs, 600);
assert.strictEqual(defaults.unitActionPaceMs, 500);
assert.strictEqual(defaults.endTurnPaceMs, 800);
assert.strictEqual(defaults.navPaceMs, 1200);

var invalid = userStrategy.errors({ schemaVersion: 1, actionOrder: ["PLAY_CARD"], maxCardPlaysPerTurn: 8 });
assert.ok(invalid.some(function (message) { return message.indexOf("END_TURN") >= 0; }));
assert.ok(invalid.some(function (message) { return message.indexOf("maxCardPlaysPerTurn") >= 0; }));

var invalidMode = userStrategy.errors({ modeType: "unknown-mode" });
assert.ok(invalidMode.some(function (message) { return message.indexOf("未知对局模式") >= 0; }));

var invalidPace = userStrategy.errors({ cardPlayPaceMs: 50, endTurnPaceMs: 99999 });
assert.ok(invalidPace.some(function (message) { return message.indexOf("cardPlayPaceMs") >= 0; }));
assert.ok(invalidPace.some(function (message) { return message.indexOf("endTurnPaceMs") >= 0; }));

var custom = userStrategy.normalize({
    name: "低费抢线", actionOrder: ["PLAY_CARD", "OPERATE_UNIT", "END_TURN"],
    cardPreference: "LOW_COST", preferFrontlineUnits: false,
    maxCardPlaysPerTurn: 2, maxUnitActionAttemptsPerUnit: 1,
    modeType: "casual", cardPlayPaceMs: 500, unitActionPaceMs: 400,
    endTurnPaceMs: 800, navPaceMs: 1200
});
assert.strictEqual(custom.modeType, "casual");
assert.strictEqual(custom.cardPlayPaceMs, 500);
assert.strictEqual(custom.endTurnPaceMs, 800);

var clamped = userStrategy.normalize({ cardPlayPaceMs: 10, endTurnPaceMs: 99999, navPaceMs: 50 });
assert.strictEqual(clamped.cardPlayPaceMs, 300);
assert.strictEqual(clamped.endTurnPaceMs, 10000);
assert.strictEqual(clamped.navPaceMs, 800);

var tree = userStrategy.toDecisionTree(custom);
assert.strictEqual(tree.root.children[0].then.action.kind, "PLAY_CARD");
assert.strictEqual(tree.root.children[1].then.action.kind, "OPERATE_UNIT");
var config = {};
userStrategy.apply(config, custom);
assert.strictEqual(config.cardPreference, "LOW_COST");
assert.strictEqual(config.maxPlayAttemptsPerTurn, 2);
assert.strictEqual(config.decisionTreeOverride.root.children.length, 3);
assert.strictEqual(config.modeType, "casual");
assert.strictEqual(config.cardPlayPaceMs, 500);
assert.strictEqual(config.navPaceMs, 1200);
// 安全项必须强制覆盖，不可被用户策略修改
assert.strictEqual(config.minUiConfidence, 0.80);
assert.strictEqual(config.requireCostBadge, true);
assert.strictEqual(config.minStableHandFrames, 2);
console.log("user strategy config ok");
