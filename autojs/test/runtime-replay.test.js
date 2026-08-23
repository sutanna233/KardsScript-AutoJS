var assert = require("assert");
var base = require("../lib/config");
var runtime = require("../lib/runtime");
var strategy = require("../lib/strategy");
var vision = require("../lib/vision");
var png = require("../tools/png-decode");

var presses = [];
global.currentPackage = function () { return base.kardsPackage; };
global.press = function (x, y) { presses.push([x, y]); return true; };
global.swipe = function (x1, y1, x2, y2) { presses.push([x1, y1, x2, y2]); return true; };
global.toast = function () {};

var config = {};
Object.keys(base).forEach(function (key) { config[key] = base[key]; });
var driverEvents = [];
config.actionLogger = function (event) { driverEvents.push(event); };
config.mode = "automatic";
config.allowNavigation = true;
config.allowBattleActions = true;
config.maxSameSceneFrames = 99;
config.endTurnSettleMs = 60000;
// Most unit-level replay cases exercise one transaction directly. Keep them
// single-frame and cover the production two-frame gate in a dedicated case.
config.minStableHandFrames = 1;
// 回放测试验证精确坐标校准（806/518/674 等），关闭拟人化抖动以保证确定性。
config.humanize = { enabled: false, tapJitterRadius: 8, swipeJitterRadius: 6, paceVariance: 0.35, thinkTimeBaseMs: 50 };

function observation(screen, scene, state, legalTargets) {
    return {
        uiScreen: { screen: screen, confidence: 1, ruleId: "replay" },
        scene: { scene: scene, confidence: 1, ruleId: "replay" },
        state: state || { scene: scene, hand: [], units: [], credits: 0 },
        legalTargets: legalTargets || [], frame: { width: 1280, height: 720 }
    };
}

var menu = runtime.create(config);
menu.tick(observation("HOME", "MENU"));
assert.strictEqual(presses.length, 1, "HOME should advance exactly once");
presses.length = 0;
menu.tick(observation("DAILY_QUEST", "UNKNOWN"));
assert.strictEqual(presses.length, 1, "daily quest modal should be dismissed before navigation");
presses.length = 0;
menu.tick(observation("POPUP", "UNKNOWN"));
assert.strictEqual(presses.length, 1, "promotional popup should be closed before navigation");

presses.length = 0;
var battle = runtime.create(config);
var card = { id: "hand-1", bounds: [0.4, 0.5, 0.5, 0.7], confidence: 0.9, playable: true, cost: 1 };
battle.tick(observation("BATTLE", "OUR_TURN", { scene: "OUR_TURN", hand: [card], units: [], credits: 2 }));
assert.strictEqual(presses.length, 1, "first battle frame should drag the confirmed source to a free measured deployment lane");
assert.strictEqual(presses[0][2], 806, "card drag must try the measured right deployment lane before the commonly occupied starter lane");
assert.strictEqual(presses[0][3], 518, "card drag must use the measured deployment y coordinate");
var directDriver = require("../lib/driver").create(config);
presses.length = 0;
directDriver.playCard(card, 0, { width: 1280, height: 720 }, { units: [{ owner: "PLAYER", bounds: [0.32, 0.57, 0.42, 0.69] }] });
assert.strictEqual(presses[0][2], 806, "driver must preserve the concrete slot index selected by runtime");
presses.length = 0;
var fanCard = { id: "hand-3", bounds: [510 / 1280, 660 / 720, 570 / 1280, 1], confidence: 0.9, playable: true };
directDriver.playCard(fanCard, 0, { width: 1280, height: 720 }, {}, 0);
assert.strictEqual(presses[0][1], 674, "bottom-fan drag must start on the measured exposed strip instead of the overlapped rectangle centre");
assert.strictEqual(driverEvents[driverEvents.length - 1].kind, "PLAY_CARD", "card drag must emit auditable action telemetry");
assert.deepStrictEqual(driverEvents[driverEvents.length - 1].from, [540, 674], "card telemetry must preserve the exact calibrated source coordinate");
battle.tick(observation("BATTLE", "OUR_TURN", { scene: "OUR_TURN", hand: [], units: [], credits: 2 }));
assert.strictEqual(presses.length, 1, "a successful card play must not issue a second drag");
assert.strictEqual(battle.status().last, "出牌已由手牌减少一张确认", "a high-confidence one-card decrease must confirm any card type");

// Dynamic board slot relabeling can keep the player-unit count unchanged
// after deployment. A new player unit id is still direct deployment evidence.
presses.length = 0;
var relabel = runtime.create(config);
var oldUnit = { id: "player-rear-left-1", owner: "PLAYER", bounds: [0.30, 0.60, 0.38, 0.82], confidence: 0.9, canOperate: false };
var newUnit = { id: "player-rear-right-1", owner: "PLAYER", bounds: [0.56, 0.60, 0.64, 0.82], confidence: 0.9, canOperate: false };
relabel.tick(observation("BATTLE", "OUR_TURN", { scene: "OUR_TURN", hand: [card], units: [oldUnit], credits: 2 }));
relabel.tick(observation("BATTLE", "OUR_TURN", { scene: "OUR_TURN", hand: [card], units: [newUnit], credits: 1 }));
assert.strictEqual(relabel.status().last, "出牌已由己方单位出现确认", "a relabeled new player unit must confirm deployment even when count is unchanged");

// A newly deployed unit can act immediately when the game paints its live
// operation-cost badge orange. Dynamic slot ids must not quarantine it.
presses.length = 0;
var cooldown = runtime.create(config);
var deployed = { id: "player-front-mid", owner: "PLAYER", bounds: [0.45, 0.32, 0.65, 0.58], confidence: 0.9, canOperate: true, orangeMoveCost: true, isFrontline: true };
var deployedEnemy = { id: "enemy-front-mid", kind: "ENEMY_UNIT", legal: true, bounds: [0.45, 0.20, 0.65, 0.40], confidence: 0.95, isFrontline: true };
cooldown.tick(observation("BATTLE", "OUR_TURN", { scene: "OUR_TURN", hand: [card], units: [], credits: 2 }));
cooldown.tick(observation("BATTLE", "OUR_TURN", { scene: "OUR_TURN", hand: [], units: [deployed], credits: 1 }));
assert.strictEqual(cooldown.status().last, "出牌已由己方单位出现确认", "a newly visible friendly unit must confirm deployment without waiting for noisy hand stability");
cooldown.tick(observation("BATTLE", "OUR_TURN", { scene: "OUR_TURN", hand: [], units: [deployed], credits: 1 }, [deployedEnemy]));
assert.strictEqual(presses.length, 2, "a newly deployed unit with an orange operation badge must be allowed to act");
assert.strictEqual(presses[1].length, 4, "the newly ready unit must use the continuous attack drag");

// A transient UNKNOWN/fade frame must not clear that cooldown or pending
// state before a positively identified opponent turn.
presses.length = 0;
var fade = runtime.create(config);
fade.tick(observation("BATTLE", "OUR_TURN", { scene: "OUR_TURN", hand: [card], units: [], credits: 2 }));
fade.tick(observation("BATTLE", "UNKNOWN", { scene: "UNKNOWN", hand: [card], units: [], credits: 2 }));
fade.tick(observation("BATTLE", "OUR_TURN", { scene: "OUR_TURN", hand: [], units: [deployed], credits: 1 }));
assert.strictEqual(presses.length, 1, "UNKNOWN fade must preserve pending play confirmation");

// A fast turn transition must invalidate a stale pending source/target
// handshake instead of carrying it into the next turn.
presses.length = 0;
var transition = runtime.create(config);
transition.tick(observation("BATTLE", "OUR_TURN", { scene: "OUR_TURN", hand: [card], units: [], credits: 2 }));
transition.tick(observation("BATTLE", "OPPONENT_TURN", { scene: "OPPONENT_TURN", hand: [card], units: [], credits: 2 }));
assert.strictEqual(presses.length, 1, "turn transition must clear the pending card action");

presses.length = 0;
var noTarget = runtime.create(config);
noTarget.tick(observation("BATTLE", "OUR_TURN", { scene: "OUR_TURN", hand: [card], units: [], credits: 2 }));
assert.strictEqual(presses.length, 1, "a card play must issue exactly one source selection before visual confirmation");

var stableConfig = {};
Object.keys(config).forEach(function (key) { stableConfig[key] = config[key]; });
stableConfig.minStableHandFrames = 2;
var stableHandBot = runtime.create(stableConfig);
var stableOrange = { id: "hand-1", bounds: [0.20, 0.60, 0.30, 0.75], confidence: 0.9,
    playable: true, costBadgeOrange: true, costBadge: { orange: true, score: 0.10 }, playConfidence: 0.85 };
presses.length = 0;
stableHandBot.tick(observation("BATTLE", "OUR_TURN", { scene: "OUR_TURN", hand: [stableOrange], units: [], credits: 2, handConfidence: 0.9 }));
assert.strictEqual(presses.length, 0, "production card play must wait for a second identical hand/orange signature frame");
assert.strictEqual(stableHandBot.status().last, "等待手牌数量和橙色费用状态连续两帧稳定");
stableHandBot.tick(observation("BATTLE", "OUR_TURN", { scene: "OUR_TURN", hand: [stableOrange], units: [], credits: 2, handConfidence: 0.9 }));
assert.strictEqual(presses.length, 1, "the same orange source on two consecutive frames may be dragged");

// END_TURN must use the same two-frame hand/badge stability as PLAY_CARD.
// A turn-transition frame can briefly paint every cost grey; if the next
// stable frame exposes an orange card, the bot must play it instead of having
// already ended the turn.
var delayedOrangeBot = runtime.create(stableConfig);
var firstGrey = { id: "hand-1", bounds: stableOrange.bounds, confidence: 0.9,
    playable: false, costBadgeOrange: false, costBadge: { orange: false, score: 0 }, playConfidence: 0 };
presses.length = 0;
delayedOrangeBot.tick(observation("BATTLE", "OUR_TURN", { scene: "OUR_TURN", hand: [firstGrey], units: [], credits: null, handConfidence: 0.9 }));
assert.strictEqual(presses.length, 0, "first grey transition frame must not immediately end the turn");
assert.strictEqual(delayedOrangeBot.status().last, "等待手牌与费用颜色稳定后再决定是否结束回合");
delayedOrangeBot.tick(observation("BATTLE", "OUR_TURN", { scene: "OUR_TURN", hand: [stableOrange], units: [], credits: null, handConfidence: 0.9 }));
assert.strictEqual(presses.length, 0, "changed orange signature must restart the two-frame stability gate");
delayedOrangeBot.tick(observation("BATTLE", "OUR_TURN", { scene: "OUR_TURN", hand: [stableOrange], units: [], credits: null, handConfidence: 0.9 }));
assert.strictEqual(presses.length, 1, "stable orange card must be dragged before END_TURN");
assert.strictEqual(presses[0].length, 4, "delayed orange action must be a card drag, not an END_TURN tap");

// A rejected deployment must not make the bot skip the whole turn. Retry the
// same orange source in the next measured area before quarantining that card.
var retryConfig = {};
Object.keys(config).forEach(function (key) { retryConfig[key] = config[key]; });
retryConfig.playCardSettleMs = 0;
retryConfig.playCardConfirmTimeoutMs = 0;
retryConfig.deploymentSettleWaitMs = 0;
retryConfig.maxPlayAttemptsPerTurn = 2;
retryConfig.deploymentSlots = [{ id: "only-slot", bounds: [0.32, 0.57, 0.42, 0.69] }, { id: "second-slot", bounds: [0.58, 0.57, 0.68, 0.69] }];
var retry = runtime.create(retryConfig);
var first = { id: "hand-1", bounds: [0.20, 0.60, 0.30, 0.75], confidence: 0.9, playable: true, cost: 2 };
var second = { id: "hand-2", bounds: [0.35, 0.60, 0.45, 0.75], confidence: 0.9, playable: true, cost: 1 };
presses.length = 0;
retry.tick(observation("BATTLE", "OUR_TURN", { scene: "OUR_TURN", hand: [first, second], units: [], credits: 2 }));
retry.tick(observation("BATTLE", "OUR_TURN", { scene: "OUR_TURN", hand: [first, second], units: [], credits: 2 }));
retry.tick(observation("BATTLE", "OUR_TURN", { scene: "OUR_TURN", hand: [first, second], units: [], credits: 2 }));
retry.tick(observation("BATTLE", "OUR_TURN", { scene: "OUR_TURN", hand: [first, second], units: [], credits: 2 }));
assert.strictEqual(presses.length, 2, "after the first failed drag, the next frame must retry in the other measured area");
assert.strictEqual(presses[0][0], presses[1][0], "deployment-area retry must keep the same confirmed orange card source");
assert.notStrictEqual(presses[0][2], presses[1][2], "deployment-area retry must rotate to a different destination");
retry.tick(observation("BATTLE", "OUR_TURN", { scene: "OUR_TURN", hand: [first, second], units: [], credits: 2 }));
retry.tick(observation("BATTLE", "OUR_TURN", { scene: "OUR_TURN", hand: [first, second], units: [], credits: 2 }));
retry.tick(observation("BATTLE", "OUR_TURN", { scene: "OUR_TURN", hand: [first, second], units: [], credits: 2 }));
retry.tick(observation("BATTLE", "OUR_TURN", { scene: "OUR_TURN", hand: [first, second], units: [], credits: 2 }));
assert.strictEqual(presses.length, 3, "only after all bounded card attempts fail may the bot issue END_TURN");

presses.length = 0;
var endTurnCooldown = runtime.create(config);
var emptyTurn = { scene: "OUR_TURN", hand: [], units: [], credits: 0 };
endTurnCooldown.tick(observation("BATTLE", "OUR_TURN", emptyTurn));
endTurnCooldown.tick(observation("BATTLE", "OUR_TURN", emptyTurn));
assert.strictEqual(presses.length, 1, "end turn must not be retried before its UI state settles");

var hq = { id: "enemy-hq", kind: "ENEMY_HQ", legal: true, bounds: [0.45, 0.1, 0.55, 0.2], confidence: 0.9 };
var guard = { id: "enemy-guard", kind: "ENEMY_UNIT", legal: true, isGuard: true, bounds: [0.2, 0.2, 0.3, 0.4], confidence: 0.9, threat: 1 };
assert.strictEqual(strategy.chooseTarget([hq, guard]).id, "enemy-guard", "confirmed guard must take priority over headquarters");
assert.strictEqual(strategy.chooseTarget([hq]).id, "enemy-hq", "headquarters is preferred only without a confirmed guard");
var frontGuard = { id: "enemy-front-guard", kind: "ENEMY_UNIT", legal: true, isGuard: true, isFrontline: true, bounds: [0.2, 0.34, 0.3, 0.48], confidence: 0.9, threat: 1 };
var frontUnit = { id: "enemy-front", kind: "ENEMY_UNIT", legal: true, isFrontline: true, bounds: [0.2, 0.34, 0.3, 0.48], confidence: 0.9, threat: 1 };
var friendlyGuard = { id: "friendly-front-guard", kind: "FRIENDLY_UNIT", legal: true, isGuard: true, isFrontline: true, bounds: [0.2, 0.50, 0.3, 0.64], confidence: 0.9 };
assert.strictEqual(strategy.chooseTarget([hq, guard, frontGuard]).id, "enemy-front-guard", "frontline guard must take priority over other guards");
assert.strictEqual(strategy.chooseTarget([hq, frontUnit], { preferFrontlineUnits: true }).id, "enemy-front", "frontline policy must prefer frontline unit over headquarters");
assert.strictEqual(strategy.chooseTarget([hq, frontUnit], config).id, "enemy-front", "frontline preference must be enabled by default");
assert.strictEqual(strategy.chooseTarget([hq, friendlyGuard]).id, "enemy-hq", "friendly guard must never be selected as an enemy guard");
var endTurn = { id: "end-turn", kind: "END_TURN", legal: true, bounds: [0.84, 0.68, 0.97, 0.76], confidence: 0.9 };
var deployment = { id: "player-rear-mid", kind: "FRIENDLY_UNIT", legal: true, bounds: [0.41, 0.64, 0.59, 0.78], confidence: 0.9 };
assert.strictEqual(strategy.chooseTarget([hq, endTurn, deployment], null, "PLAY_CARD").id, "player-rear-mid", "card plays must select only friendly deployment slots");
assert.strictEqual(strategy.chooseTarget([hq, endTurn], null, "PLAY_CARD"), null, "card plays must never turn END_TURN into a target");
assert.strictEqual(strategy.chooseTarget([hq, endTurn], null, "ATTACK").id, "enemy-hq", "attacks must exclude END_TURN from legal targets");

// Rear units move with one continuous press-drag-release gesture onto the
// measured shared frontline. There is no preliminary source tap and no
// source-aligned fictitious deployment cell.
var rearUnit = { id: "player-rear-mid", owner: "PLAYER", type: "INFANTRY", bounds: [0.34, 0.64, 0.50, 0.78], confidence: 0.65, canOperate: true, isFrontline: false };
var frontUnit = { id: "player-front-mid", owner: "PLAYER", bounds: [0.45, 0.32, 0.65, 0.58], confidence: 0.65, canOperate: true, isFrontline: true };
var moveBot = runtime.create(config);
presses.length = 0;
var rearState = { scene: "OUR_TURN", hand: [], units: [rearUnit], credits: 0, handConfidence: 0.9, frontlineY: 356, frameHeight: 720 };
moveBot.tick(observation("BATTLE", "OUR_TURN", rearState));
assert.strictEqual(presses.length, 1, "rear-unit movement must send one continuous drag immediately");
assert.strictEqual(presses[0][2], 640, "frontline move must release at the shared board centre, not mirror the rear source x");
assert.strictEqual(presses[0][3], 356, "frontline move must use the detected divider y");
var legalFrontline = { id: "player-front-mid", kind: "FRIENDLY_UNIT", legal: true, bounds: [0.45, 0.32, 0.65, 0.58], confidence: 0.95, isFrontline: true };
moveBot.tick(observation("BATTLE", "OUR_TURN", rearState, [legalFrontline]));
assert.strictEqual(presses.length, 1, "pending movement confirmation must not emit a second drag or tap");
moveBot.tick(observation("BATTLE", "OUR_TURN", { scene: "OUR_TURN", hand: [], units: [frontUnit], credits: 0, handConfidence: 0.9 }));
assert.strictEqual(presses.length, 1, "confirmed frontline arrival must not repeat the move drag");
moveBot.tick(observation("BATTLE", "OUR_TURN", { scene: "OUR_TURN", hand: [], units: [frontUnit], credits: 0, handConfidence: 0.9 }));
assert.strictEqual(presses.length, 1, "confirmed frontline arrival must not emit a stray source tap");

// An unknown rear unit follows the user-confirmed temporary infantry rule.
// If the player already owns the centre of the shared frontline, release at
// the next measured free point instead of treating the line as unavailable.
var unknownRear = { id: "player-rear-right", owner: "PLAYER", type: "UNKNOWN", bounds: [0.62, 0.64, 0.72, 0.78], confidence: 0.7, canOperate: true, isFrontline: false };
var occupiedFront = { id: "player-front-centre", owner: "PLAYER", type: "TANK", bounds: [0.45, 0.32, 0.65, 0.58], confidence: 0.9, canOperate: false, isFrontline: true };
var occupiedMoveBot = runtime.create(config);
presses.length = 0;
occupiedMoveBot.tick(observation("BATTLE", "OUR_TURN", { scene: "OUR_TURN", hand: [], units: [occupiedFront, unknownRear], credits: 0,
    handConfidence: 0.9, frontlineOwner: "PLAYER", frontlineY: 356, frameHeight: 720 }));
assert.strictEqual(presses.length, 1, "unknown rear ground unit must still move when the player already owns the frontline");
assert.strictEqual(presses[0][2], 493, "occupied centre must shift the frontline release to the next measured free point");
assert.strictEqual(presses[0][3], 342, "occupied-frontline move must use the unit row, not the divider that moved upward after capture");

var missedFrontBot = runtime.create(config);
presses.length = 0;
missedFrontBot.tick(observation("BATTLE", "OUR_TURN", { scene: "OUR_TURN", hand: [], units: [unknownRear], credits: 0,
    handConfidence: 0.9, frontlineOwner: "PLAYER", frontlineY: 264, frameHeight: 720 }));
assert.strictEqual(presses[0][2], 493, "player ownership must avoid the likely central incumbent even if its rectangle flickers out");
assert.strictEqual(presses[0][3], 342, "moved ownership divider must never become the occupied-row release y");

// The two-attempt safety limit is per unit/action. It must not become a
// whole-turn cap that prevents a third ready unit from acting.
var multiBot = runtime.create(config);
var u1 = { id: "u1", owner: "PLAYER", type: "TANK", bounds: [0.20, 0.32, 0.30, 0.50], confidence: 0.9, canOperate: true, isFrontline: true };
var u2 = { id: "u2", owner: "PLAYER", type: "INFANTRY", bounds: [0.35, 0.32, 0.45, 0.50], confidence: 0.9, canOperate: true, isFrontline: true };
var u3 = { id: "u3", owner: "PLAYER", type: "TANK", bounds: [0.55, 0.32, 0.65, 0.50], confidence: 0.9, canOperate: true, isFrontline: true };
var hqOnly = { id: "enemy-hq", kind: "ENEMY_HQ", legal: true, bounds: [0.45, 0.10, 0.55, 0.25], confidence: 0.95 };
function multiState(a, b, c) { return { scene: "OUR_TURN", hand: [], units: [a, b, c], credits: 0, handConfidence: 0.9, frontlineOwner: "PLAYER" }; }
presses.length = 0;
multiBot.tick(observation("BATTLE", "OUR_TURN", multiState(u1, u2, u3), [hqOnly]));
var u1Spent = Object.assign({}, u1, { canOperate: false });
multiBot.tick(observation("BATTLE", "OUR_TURN", multiState(u1Spent, u2, u3), [hqOnly]));
multiBot.tick(observation("BATTLE", "OUR_TURN", multiState(u1Spent, u2, u3), [hqOnly]));
var u2Spent = Object.assign({}, u2, { canOperate: false });
multiBot.tick(observation("BATTLE", "OUR_TURN", multiState(u1Spent, u2Spent, u3), [hqOnly]));
multiBot.tick(observation("BATTLE", "OUR_TURN", multiState(u1Spent, u2Spent, u3), [hqOnly]));
assert.strictEqual(presses.length, 3, "all three confirmed ready units must act; the retry ceiling is not a turn-wide action cap");

// Once a frontline source has a visually confirmed legal enemy target, the
// second phase must use a swipe (the KARDS attack gesture), not a target tap.
var attackBot = runtime.create(config);
presses.length = 0;
var enemyTarget = { id: "enemy-front-mid", kind: "ENEMY_UNIT", legal: true, bounds: [0.45, 0.34, 0.65, 0.48], confidence: 0.95, isFrontline: true };
var frontlineState = { scene: "OUR_TURN", hand: [], units: [frontUnit], credits: 0, handConfidence: 0.9 };
attackBot.tick(observation("BATTLE", "OUR_TURN", frontlineState));
assert.strictEqual(presses.length, 0, "attack must wait for a confirmed enemy target");
attackBot.tick(observation("BATTLE", "OUR_TURN", frontlineState, [enemyTarget]));
assert.strictEqual(presses.length, 1, "confirmed attack should send exactly one continuous gesture");
assert.strictEqual(presses[0].length, 4, "attack gesture must be a press-drag-release swipe");
assert.strictEqual(driverEvents[driverEvents.length - 1].kind, "ATTACK_UNIT", "attack drag must emit auditable action telemetry");
assert.strictEqual(driverEvents[driverEvents.length - 1].sourceId, frontUnit.id, "attack telemetry must identify the friendly source");
assert.strictEqual(driverEvents[driverEvents.length - 1].targetId, enemyTarget.id, "attack telemetry must identify the enemy target");
var exhaustedFrontlineState = { scene: "OUR_TURN", hand: [], units: [
    { id: frontUnit.id, owner: "PLAYER", bounds: frontUnit.bounds, confidence: 0.65, canOperate: false, orangeMoveCost: false, isFrontline: true }
], credits: 0, handConfidence: 0.9 };
attackBot.tick(observation("BATTLE", "OUR_TURN", exhaustedFrontlineState, [enemyTarget]));
assert.strictEqual(attackBot.status().last, "单位攻击已由棋盘状态变化确认", "first attack must be confirmed from the consumed orange operation badge");
var reassignedReadyState = { scene: "OUR_TURN", hand: [], units: [
    { id: frontUnit.id, owner: "PLAYER", bounds: [0.57, 0.32, 0.67, 0.58], confidence: 0.65, canOperate: true, orangeMoveCost: true, isFrontline: true }
], credits: 0, handConfidence: 0.9 };
attackBot.tick(observation("BATTLE", "OUR_TURN", reassignedReadyState, [enemyTarget]));
assert.strictEqual(presses.length, 2, "a later orange-ready unit reusing a dynamic slot id must still attack before END_TURN");
var thirdReadyState = { scene: "OUR_TURN", hand: [], units: [
    { id: "player-front-right", owner: "PLAYER", bounds: [0.70, 0.32, 0.80, 0.58], confidence: 0.65, canOperate: true, orangeMoveCost: true, isFrontline: true }
], credits: 0, handConfidence: 0.9 };
attackBot.tick(observation("BATTLE", "OUR_TURN", thirdReadyState, [enemyTarget]));
attackBot.tick(observation("BATTLE", "OUR_TURN", thirdReadyState, [enemyTarget]));
assert.strictEqual(presses.length, 3, "a third distinct ready unit must not be suppressed by another unit's retry limit");
assert.strictEqual(presses[2].length, 4, "the third distinct ready unit must issue its own attack drag");

var repeatSourceBot = runtime.create(config);
presses.length = 0;
repeatSourceBot.tick(observation("BATTLE", "OUR_TURN", frontlineState, [enemyTarget]));
repeatSourceBot.tick(observation("BATTLE", "OUR_TURN", exhaustedFrontlineState, [enemyTarget]));
repeatSourceBot.tick(observation("BATTLE", "OUR_TURN", frontlineState, [enemyTarget]));
assert.strictEqual(presses.length, 2, "after confirmation the same physical source may lead only to END_TURN, not a duplicate attack");
assert.strictEqual(presses[0].length, 4, "first source action remains one attack drag");
assert.strictEqual(presses[1].length, 2, "same-position source is blocked and cannot emit a second attack drag");

var previousFeatures = {
    "enemy-hq": { L: 0, S: 0, E: 0 },
    "enemy-front-left": { L: 0, S: 0, E: 0 }
};
var highlightedFeatures = {
    "enemy-hq": { L: 120, S: 0, E: 0 },
    "enemy-front-left": { L: 120, S: 0, E: 0 }
};
var guardedTargets = vision._private.legalTargets(highlightedFeatures, previousFeatures, config, [{ slotId: "enemy-front-left", confidence: 0.95 }]);
assert.strictEqual(guardedTargets.filter(function (target) { return target.id === "enemy-front-left"; })[0].isGuard, true, "enemy-slot guard marker must attach to that enemy target");
assert.strictEqual(strategy.chooseTarget(guardedTargets).id, "enemy-front-left", "frontline guard must beat an equally legal headquarters target");

// The calibrated HQ regions must cover the actual central cards, not the old
// top HUD/bottom hand areas. Replay the real before/after pair and ensure the
// enemy HQ change is visible to the legal-target detector.
assert.deepStrictEqual(config.targetSlots.filter(function (slot) { return slot.id === "enemy-hq"; })[0].bounds, [0.40, 0.10, 0.60, 0.40]);
assert.deepStrictEqual(config.targetSlots.filter(function (slot) { return slot.id === "player-hq"; })[0].bounds, [0.40, 0.60, 0.60, 0.90]);
var hqBefore = png.decodePng("fixtures/after-action-test.png");
var hqAfter = png.decodePng("fixtures/after-one-action-cost0.png");
function targetFeatures(frame) {
    var result = {};
    config.targetSlots.forEach(function (slot) { result[slot.id] = vision._private.feature(frame, slot.bounds); });
    return result;
}
var hqTargets = vision._private.legalTargets(targetFeatures(hqAfter), targetFeatures(hqBefore), config, []);
assert.ok(hqTargets.some(function (target) { return target.id === "enemy-hq"; }), "calibrated enemy HQ must be detectable as a highlighted target");

console.log("runtime replay ok");
