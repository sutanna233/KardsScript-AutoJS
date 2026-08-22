var assert = require("assert");
var decision = require("../lib/decision");
var strategy = require("../lib/strategy");

assert.deepStrictEqual(decision.errors(decision.fallback), []);
var bad = JSON.parse(JSON.stringify(decision.fallback));
bad.root.children[0].then.action.legalOnly = false;
assert.ok(decision.errors(bad).some(function (error) { return error.indexOf("legalOnly") >= 0; }));
var action = decision.decide(decision.fallback, { scene: "OUR_TURN", hand: [{ playable: true, cost: 1 }], units: [], credits: 2 });
assert.strictEqual(action.kind, "PLAY_CARD");
assert.strictEqual(decision.decide(decision.fallback, { scene: "OPPONENT_TURN", hand: [], units: [] }), null);
var unknownOrange = { id: "unknown-orange", type: "UNKNOWN", playable: true, costBadgeOrange: true };
assert.strictEqual(strategy._private.playable([unknownOrange], null, { requireCostBadge: true, requireUnitTypeForDeployment: false }).length, 1,
    "an orange card must remain playable even when its type is UNKNOWN");
var lowConfidenceExpensive = { id: "low", playable: true, costBadgeOrange: true, costBadgeScore: 0.20, confidence: 0.62, cost: 5, priority: 9 };
var highConfidenceCheap = { id: "high", playable: true, costBadgeOrange: true, costBadgeScore: 0.08, confidence: 0.88, cost: 1, priority: 0 };
assert.strictEqual(strategy.pickPlayableCard([lowConfidenceExpensive, highConfidenceCheap], {}, { requireCostBadge: true }).id, "high",
    "the visually highest-confidence playable card must beat a more expensive or higher-priority uncertain card");
var sameConfidenceWeakBadge = { id: "weak-badge", playable: true, costBadgeOrange: true, costBadgeScore: 0.04, confidence: 0.80, cost: 4 };
var sameConfidenceStrongBadge = { id: "strong-badge", playable: true, costBadgeOrange: true, costBadgeScore: 0.12, confidence: 0.80, cost: 1 };
assert.strictEqual(strategy.pickPlayableCard([sameConfidenceWeakBadge, sameConfidenceStrongBadge], {}, { requireCostBadge: true }).id, "strong-badge",
    "orange badge evidence must break equal card-confidence ties before cost");
var playableFoil = { id: "foil", foil: "FOIL", rarity: "UNKNOWN", type: "UNKNOWN", playable: true,
    costBadgeOrange: true, costBadgeScore: 0.10, confidence: 0.78, cost: null };
assert.strictEqual(strategy.pickPlayableCard([playableFoil], {}, { requireCostBadge: true, requireUnitTypeForDeployment: false }).id, "foil",
    "foil/rarity appearance must never veto a card whose live cost badge is orange");
var highBaseButWeakPlayEvidence = { id: "base-only", playable: true, costBadgeOrange: true, confidence: 0.95, playConfidence: 0.66 };
var lowerBaseButStrongPlayEvidence = { id: "play-evidence", playable: true, costBadgeOrange: true, confidence: 0.74, playConfidence: 0.86 };
assert.strictEqual(strategy.pickPlayableCard([highBaseButWeakPlayEvidence, lowerBaseButStrongPlayEvidence], {}, { requireCostBadge: true }).id, "play-evidence",
    "combined playConfidence must be the primary card-selection key");
console.log("decision replay ok");
