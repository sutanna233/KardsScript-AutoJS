var assert = require("assert");
var vision = require("../lib/vision");
var config = require("../lib/config");
var png = require("../tools/png-decode");

function image(patch) {
    return {
        getWidth: function () { return 1280; }, getHeight: function () { return 720; },
        pixel: function (x, y) {
            var inside = patch && x >= patch.x0 && x <= patch.x1 && y >= patch.y0 && y <= patch.y1;
            return inside ? patch.color : 0xff101820;
        }
    };
}

var hand = vision._private.detectHand(image({ x0: 465, x1: 500, y0: 443, y1: 477, color: 0xffc89040 }));
assert.strictEqual(hand.cards.length, 4, "one calibrated probe must expose exactly the four-card fan");
var none = vision._private.detectHand(image());
assert.strictEqual(none.cards.length, 0, "a dark board cannot fabricate a hand");

var before = { "enemy-hq": { L: 20, S: 10, E: 0.01 } };
var after = { "enemy-hq": { L: 90, S: 90, E: 0.30 } };
var targets = vision._private.legalTargets(after, before, {
    minTargetHighlightDelta: 0.16, targetHighlightFullDelta: 0.30,
    targetSlots: [{ id: "enemy-hq", kind: "ENEMY_HQ", bounds: [0.42, 0.04, 0.58, 0.13], threat: 1000 }]
});
assert.strictEqual(targets.length, 1, "a visual highlight should yield one declared target");
assert.strictEqual(targets[0].legal, true);
assert.strictEqual(vision._private.legalTargets(after, null, config).length, 0, "a first frame cannot yield a target");

// The empty player board in this real battle frame contains the HQ and the
// horizontal frontline divider, neither of which may be reported as a unit.
var cleanBattle = vision.create(config).observe(png.decodePng("fixtures/post-action-test-now.png"));
assert.strictEqual(cleanBattle.state.units.filter(function (unit) { return unit.owner === "PLAYER"; }).length, 0, "HQ/frontline divider must not become a friendly unit");
assert.ok(cleanBattle.state.units.filter(function (unit) { return unit.owner === "ENEMY"; }).length >= 1, "visible enemy units should remain detectable");

var currentShop = vision.create(config).observe(png.decodePng("fixtures/popup-loop-current.png"));
assert.strictEqual(currentShop.uiScreen.screen, "SHOP", "current promotional shop must not be classified as HOME");
var knownHome = vision.create(config).observe(png.decodePng("fixtures/live-home.png"));
assert.strictEqual(knownHome.uiScreen.screen, "HOME", "tightened HOME saturation rule must retain the real home page");
var homeAfterShopReturn = vision.create(config).observe(png.decodePng("fixtures/navigation-after-shop-fix.png"));
assert.strictEqual(homeAfterShopReturn.uiScreen.screen, "HOME", "home after leaving the shop must not fall back into SHOP navigation");

// Current white 结束回合 and grey 敌方 controls are visually distinct in the
// same measured region. Preserve both real frames so a timed player turn can
// never be frozen by the obsolete luminance threshold.
var whitePlayerTurn = vision._private.detectBattleTurn(png.decodePng("fixtures/end-turn-stability-live-40s.png"), config);
assert.strictEqual(whitePlayerTurn.scene, "OUR_TURN", "white 结束回合 with 2/2 player credits must be our turn");
assert.strictEqual(whitePlayerTurn.ruleId, "white-end-turn-ui");
var actualOpponentTurn = vision._private.detectBattleTurn(png.decodePng("fixtures/live-test-current-1787388217301.png"), config);
assert.strictEqual(actualOpponentTurn.scene, "OPPONENT_TURN", "grey 敌方 control must remain opponent turn");

// Regression: a normal live six-card fan occupies the former generic toast
// probe region. It must not turn the whole battle into blocking-overlay.
var normalFanFrame = png.decodePng("fixtures/performance-probe-blocking-overlay.png");
assert.strictEqual(vision._private.hasBlockingOverlay(normalFanFrame, config), false,
    "normal hand cards must not be classified as a blocking overlay");
assert.notStrictEqual(vision.create(config).observe(normalFanFrame).uiScreen.ruleId, "blocking-overlay",
    "normal battle must continue through full observation");

// Regression: this live frame uses a shifted enemy rear-left lane while a
// shield marker is visible beside a friendly unit. The shifted enemy unit
// must be recovered by the alternate slot, and the friendly shield must not
// be reported as an enemy guard.
var shiftedEnemy = vision.create(config).observe(png.decodePng("fixtures/auto-run-after-stop.png"));
assert.strictEqual(shiftedEnemy.state.units.filter(function (unit) { return unit.owner === "ENEMY"; }).length, 2, "shifted enemy rear units must both be detected");
assert.strictEqual(vision._private.detectEnemyGuardMarkers(png.decodePng("fixtures/auto-run-after-stop.png"), config, shiftedEnemy.state.units).length, 0, "friendly shield must not become an enemy guard marker");

// User-labelled 224x133 crop contains an HQ marker at (98,22) and the
// adjacent guard unit's own marker at (203,22). A unit-corner search must
// include only the latter; this is the geometry invariant that prevents HQ
// shield pollution before native template matching runs.
// Preserve the crop's native pixels inside a synthetic 1280x720 frame; the
// production bounds are screen-normalized, not crop-normalized.
var labelledGuardUnit = [518 / 1280, 16 / 720, 614 / 1280, 128 / 720];
var labelledGuardPocket = vision._private.guardIconBounds(labelledGuardUnit);
function inPocket(px, py, pocket) {
    return px / 1280 >= pocket[0] && px / 1280 <= pocket[2] && py / 720 >= pocket[1] && py / 720 <= pocket[3];
}
assert.strictEqual(inPocket(603, 22, labelledGuardPocket), true, "unit guard marker must remain inside its own corner search pocket");
assert.strictEqual(inPocket(498, 22, labelledGuardPocket), false, "HQ shield marker must stay outside the adjacent unit search pocket");

// Regression: the live six-card fan contains dark artwork gaps. The old
// contiguous probe stopped at two cards; the envelope detector must retain
// the complete hand so a later drag cannot use a wrong source index.
var liveOurTurn = vision.create(config).observe(png.decodePng("fixtures/after-one-turn-continuation.png"));
assert.strictEqual(liveOurTurn.state.hand.length, 6, "live six-card fan must not collapse to two cards");
assert.strictEqual(liveOurTurn.scene.scene, "OUR_TURN", "live fan fixture must be our turn");
var badgeOnlyConfig = {};
Object.keys(config).forEach(function (key) { badgeOnlyConfig[key] = config[key]; });
badgeOnlyConfig.readCardCosts = false;
badgeOnlyConfig.readHandTypes = false;
var confidenceHand = vision.create(badgeOnlyConfig).observe(png.decodePng("fixtures/after-one-turn-continuation.png")).state.hand;
var confidencePlayable = confidenceHand.filter(function (card) { return card.playable; });
assert.strictEqual(confidencePlayable.length, 2, "real frame must retain both orange-cost playable candidates");
assert.ok(confidencePlayable[0].playConfidence > confidencePlayable[1].playConfidence,
    "stronger orange fee evidence must produce a higher independent playConfidence");
assert.strictEqual(confidencePlayable[0].type, "UNKNOWN", "hand type recognition is not required for deployment confidence");
assert.strictEqual(confidencePlayable[0].rarity, "UNKNOWN", "rarity must remain independent from playability");
assert.strictEqual(confidencePlayable[0].foil, "UNKNOWN", "foil must remain independent from playability");
var liveNineCards = vision.create(config).observe(png.decodePng("fixtures/current-type-live.png"));
assert.strictEqual(liveNineCards.state.hand.length, 9, "live nine-card fan must retain all nine measured badge/source slots");
// Real animated/gold-treated board and hand. Production deliberately ignores
// foil and has no calibrated rarity identity template: both appearance fields
// must remain UNKNOWN without suppressing the independently playable hand.
var goldTreatmentFrame = png.decodePng("fixtures/type-match-current-screen.png");
var goldTreatment = vision.create(config).observe(goldTreatmentFrame);
assert.ok(goldTreatment.state.hand.length > 0 && goldTreatment.state.hand.some(function (card) { return card.playable === true; }),
    "real gold-treated fixture must keep orange-cost playability independent from appearance fields");
assert.ok(goldTreatment.state.hand.every(function (card) { return card.rarity === "UNKNOWN" && card.foil === "UNKNOWN"; }),
    "real gold-treated cards must not infer rarity or foil while their independent production switches are disabled");
var goldFrontBounds = [0.45, 0.36, 0.55, 0.59];
assert.strictEqual(vision._private.identifyCardRarity(goldTreatmentFrame, goldFrontBounds, config), "UNKNOWN",
    "gold border/treatment alone is not calibrated rarity evidence");
assert.strictEqual(vision._private.identifyCardFoil(goldTreatmentFrame, goldFrontBounds, config), "UNKNOWN",
    "gold treatment alone must not activate foil without an explicit foil template");
// Current-build sparse fans use a much wider four/five-card layout than the
// historical leftmost-X table.  These frames are ground truth from the direct
// orange-card deployment probe.
var liveFourCards = vision._private.detectHand(png.decodePng("fixtures/direct-play-test-start.png"));
assert.strictEqual(liveFourCards.cards.length, 4, "real four-card fan must not grow to five cards");
assert.ok(Math.abs(((liveFourCards.cards[0].bounds[0] + liveFourCards.cards[0].bounds[2]) * 640) - 360) <= 2,
    "four-card first drag source must stay on the measured exposed card body");
var liveFiveCards = vision._private.detectHand(png.decodePng("fixtures/direct-orange-confirmed-success.png"));
assert.strictEqual(liveFiveCards.cards.length, 5, "real five-card fan must not grow to six cards");
assert.ok(Math.abs(((liveFiveCards.cards[0].bounds[0] + liveFiveCards.cards[0].bounds[2]) * 640) - 330) <= 2,
    "five-card first drag source must stay on the measured exposed card body");
var greyFiveFrame = png.decodePng("fixtures/sparse-five-source-failed-1787377165579.png");
var greyFive = vision._private.detectHand(greyFiveFrame);
assert.strictEqual(greyFive.cards.filter(function (card) {
    return vision._private.detectOrangeCostBadge(greyFiveFrame, card.costBounds, card.handIndex, greyFive.cards.length).orange;
}).length, 0, "grey five-card costs must not become orange from the adjacent gold title strip");
var afterRealPlay = vision.create(config).observe(png.decodePng("fixtures/after-real-play-probe.png"));
assert.strictEqual(afterRealPlay.scene.scene, "OUR_TURN", "post-drag fixture must remain our turn");
assert.ok(afterRealPlay.state.units.filter(function (unit) { return unit.owner === "PLAYER"; }).length >= 1, "post-drag fixture must contain a friendly deployed unit");
var attackFrame = vision.create(config).observe(png.decodePng("fixtures/after-relaunch-for-attack.png"));
assert.strictEqual(attackFrame.state.units.filter(function (unit) { return unit.owner === "PLAYER"; }).length, 1, "attack fixture must keep the real friendly unit");
assert.ok(/^player-rear-/.test(attackFrame.state.units.filter(function (unit) { return unit.owner === "PLAYER"; })[0].id), "enemy-controlled shared frontline must not become a friendly source");
assert.strictEqual(attackFrame.state.units.filter(function (unit) { return unit.owner === "PLAYER"; })[0].canOperate, true, "absence of a green frame must not make a fresh unit inoperable");
assert.strictEqual(attackFrame.state.units.filter(function (unit) { return unit.owner === "PLAYER"; })[0].candidateCanOperate, true, "unit ledger may authorize the source when it is not exhausted");
var liveUnitLayout = vision.create(config).observe(png.decodePng("fixtures/full-run-live-unit-layout-1787378257158.png"));
var liveFriendlyUnits = liveUnitLayout.state.units.filter(function (unit) { return unit.owner === "PLAYER"; });
assert.strictEqual(liveFriendlyUnits.length, 1, "live board must expose the real right-side unit without fabricating the central HQ");
assert.strictEqual(liveFriendlyUnits[0].id, "player-rear-right-1", "live unit beside HQ must use the first dynamic right rear source");
assert.ok(((liveFriendlyUnits[0].bounds[0] + liveFriendlyUnits[0].bounds[2]) / 2) >= 0.53,
    "right rear action centre must land inside the visible unit card, not the HQ");
var movingFormation = vision.create(config).observe(png.decodePng("fixtures/full-game-monitor-70s.png"));
var movingPlayerHq = config._activeTargetSlots.filter(function (target) { return target.kind === "FRIENDLY_HQ"; })[0];
assert.ok(movingPlayerHq, "moving formation fixture must detect the current player HQ");
assert.ok(movingFormation.state.units.filter(function (unit) { return unit.owner === "PLAYER"; }).every(function (unit) {
    var ix = Math.max(0, Math.min(unit.bounds[2], movingPlayerHq.bounds[2]) - Math.max(unit.bounds[0], movingPlayerHq.bounds[0]));
    var iy = Math.max(0, Math.min(unit.bounds[3], movingPlayerHq.bounds[3]) - Math.max(unit.bounds[1], movingPlayerHq.bounds[1]));
    return ix * iy < 0.35 * (unit.bounds[2] - unit.bounds[0]) * (unit.bounds[3] - unit.bounds[1]);
}), "the current HQ must never be exposed as an operable friendly unit");
assert.strictEqual(movingFormation.state.frontlineY, movingFormation.evidence.frontlineY,
    "runtime state must receive the measured shared-frontline y coordinate");
var dynamicHqFrame = png.decodePng("fixtures/current-state.png");
var dynamicEnemyHq = vision._private.detectHqBounds(dynamicHqFrame, true, config);
var dynamicPlayerHq = vision._private.detectHqBounds(dynamicHqFrame, false, config);
assert.ok(dynamicEnemyHq && dynamicEnemyHq[0] >= 0.1 && dynamicEnemyHq[2] <= 0.9, "enemy HQ must be located inside the adaptive upper board search");
assert.ok(dynamicPlayerHq && dynamicPlayerHq[1] >= 0.5 && dynamicPlayerHq[3] <= 0.9, "player HQ must be located inside the adaptive lower board search");
var shiftedHq = vision._private.detectHqBounds(png.decodePng("fixtures/after-real-play-probe.png"), true, config);
assert.ok(shiftedHq && shiftedHq[0] < 0.46 && shiftedHq[2] > 0.52, "adaptive enemy HQ box must cover the shifted board position");

assert.strictEqual(vision._private.detectFrontlineControl(png.decodePng("fixtures/live-after-transaction.png")).owner, "PLAYER", "divider above the shared row means we control the frontline");
assert.strictEqual(vision._private.detectFrontlineControl(png.decodePng("fixtures/diagnose-now.png")).owner, "NEUTRAL", "central divider means the frontline is neutral");
assert.strictEqual(vision._private.detectFrontlineControl(png.decodePng("fixtures/current-attack-frontline-retry.png")).owner, "ENEMY", "divider below the shared row means the enemy controls the frontline");
var liveTelemetryFrame = vision.create(config).observe(png.decodePng("fixtures/live-test-current-1787388217301.png"));
assert.strictEqual(liveTelemetryFrame.state.frontlineOwner, "ENEMY", "live telemetry frame must retain enemy frontline control");
assert.ok(liveTelemetryFrame.state.units.filter(function (unit) { return unit.owner === "PLAYER"; }).every(function (unit) {
    return unit.orangeMoveCost === false && unit.canOperate === false;
}), "gold/grey action-cost backgrounds in the opponent-turn frame must not be treated as orange readiness");
assert.ok(liveTelemetryFrame.state.units.some(function (unit) { return unit.owner === "ENEMY" && unit.isFrontline === true; }),
    "visible central enemy frontline card must not be dropped by a shallow slot probe");
assert.ok(liveTelemetryFrame.legalTargets.some(function (target) { return target.kind === "ENEMY_UNIT" && target.isFrontline === true; }),
    "the recovered enemy frontline card must become a direct legal attack target");

var turnBannerFrame = png.decodePng("fixtures/frontline-move-hqfix-before.png");
assert.strictEqual(vision._private.detectTurnTransitionBanner(turnBannerFrame), true,
    "large friendly-turn banner must block frontline decisions while it covers enemy units");
assert.strictEqual(vision.create(config).observe(turnBannerFrame).scene.scene, "UNKNOWN",
    "battle scene must wait until the turn-transition banner disappears");
assert.strictEqual(vision._private.detectTurnTransitionBanner(png.decodePng("fixtures/frontline-ourturn-probe.png")), false,
    "ordinary orange unit costs must not be mistaken for the wide turn banner");

// Live 2/2-resource turn from the single-game run. Its active end-turn text
// has E=.259, below the former .30 gate, while remaining much brighter than
// the measured opponent control. It must never stall as OPPONENT_TURN.
var whiteControlTurn = vision.create(config).observe(png.decodePng("fixtures/single-game-stall-139s.png"));
assert.strictEqual(whiteControlTurn.scene.scene, "OUR_TURN",
    "bright active end-turn control must classify the real 2/2 frame as our turn");
assert.ok(whiteControlTurn.state.hand.some(function (card) { return card.playable === true; }),
    "the same real frame must retain its orange-cost playable card");

var reconnect = vision.create(config).observe(png.decodePng("fixtures/current-home-nav.png"));
assert.strictEqual(reconnect.uiScreen.screen, "RECONNECT", "inactive-session modal must beat HOME classification");
assert.strictEqual(reconnect.scene.scene, "RECONNECTING");
var daily = vision.create(config).observe(png.decodePng("fixtures/current-attack-final-check.png"));
assert.strictEqual(daily.uiScreen.screen, "DAILY_QUEST", "daily quest modal must be classified before HOME navigation");
var currentRewardResult = vision.create(config).observe(png.decodePng("fixtures/unknown-after-unit-slot-fix-1787378716040.png"));
assert.strictEqual(currentRewardResult.uiScreen.screen, "RESULT", "current level-reward overlay must be classified as RESULT");
assert.strictEqual(currentRewardResult.uiScreen.ruleId, "template-result-continue", "reward overlay must map to the bottom Continue action");
var home = vision.create(config).observe(png.decodePng("fixtures/live-home.png"));
assert.strictEqual(home.uiScreen.screen, "HOME", "normal home screen must remain HOME");
console.log("vision replay ok");
