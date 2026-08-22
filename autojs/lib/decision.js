var domain = require("./domain");

var fields = { scene: true, credits: true, handCount: true, hasPlayableCard: true, hasOperableUnit: true, hasLegalTarget: true, canLethal: true, enemyUnitCount: true, playerUnitCount: true, frontlineControlled: true, confidence: true };
var kinds = { PLAY_CARD: true, OPERATE_UNIT: true, MOVE_TO_FRONTLINE: true, ATTACK: true, END_TURN: true };
var operators = { EQ: true, NE: true, GT: true, GTE: true, LT: true, LTE: true, EXISTS: true, NOT_EXISTS: true };

var fallback = { schemaVersion: 1, name: "安全默认策略", root: { id: "root", type: "priority", children: [
    { id: "play", type: "condition", whenAll: [{ field: "hasPlayableCard", operator: "EQ", value: "true" }], then: { id: "play-best", type: "action", action: { kind: "PLAY_CARD", cardSort: ["USER_PRIORITY_DESC", "DEPLOYMENT_COST_DESC"], targetSort: ["THREAT_DESC", "ENEMY_HQ_FIRST"], legalOnly: true } } },
    { id: "operate", type: "condition", whenAll: [{ field: "hasOperableUnit", operator: "EQ", value: "true" }], then: { id: "operate-best", type: "action", action: { kind: "OPERATE_UNIT", actorSort: ["ATTACK_DESC"], targetSort: ["THREAT_DESC", "ENEMY_HQ_FIRST"], legalOnly: true } } },
    { id: "end-turn", type: "action", action: { kind: "END_TURN" } }
] } };

function errors(tree) {
    var out = [];
    function walk(node, depth) {
        if (!node || typeof node !== "object") return out.push("规则节点无效");
        if (depth > 32) out.push("规则树深度不能超过 32");
        if (!node.id || !node.type) out.push("规则节点缺少 id/type");
        if (node.type === "priority" || node.type === "sequence") {
            if (!Array.isArray(node.children) || !node.children.length) out.push(node.type + " 没有分支");
            else node.children.forEach(function (child) { walk(child, depth + 1); });
        } else if (node.type === "condition") {
            if (!Array.isArray(node.whenAll) || !node.whenAll.length) out.push("condition 没有条件");
            (node.whenAll || []).forEach(function (p) { if (!fields[p.field]) out.push("未知字段: " + p.field); if (!operators[p.operator || "EQ"]) out.push("未知比较符: " + p.operator); });
            walk(node.then, depth + 1);
        } else if (node.type === "action") {
            var action = node.action || {};
            if (!kinds[action.kind]) out.push("未知动作: " + action.kind);
            if (action.kind !== "END_TURN" && action.legalOnly !== true) out.push(node.id + " 必须启用 legalOnly");
        } else out.push("未知节点类型: " + node.type);
    }
    if (!tree || tree.schemaVersion !== 1 || !tree.root) out.push("决策树 schemaVersion/root 无效"); else walk(tree.root, 0);
    return out;
}
function stateValue(state, field) {
    var hand = state.hand || [], units = state.units || [];
    if (field === "scene") return state.scene;
    if (field === "credits") return state.credits;
    if (field === "handCount") return hand.length;
    if (field === "hasPlayableCard") return hand.some(function (card) {
        return card.playable === true && (card.costBadgeOrange === true || (!card.costBadgeOrange && (!card.costBadge || card.costBadge.orange === true)));
    });
    if (field === "hasOperableUnit") return units.some(function (unit) { return unit.owner === "PLAYER" && unit.canOperate; });
    if (field === "hasLegalTarget") return (state.legalTargets || []).length > 0;
    if (field === "canLethal") return false;
    if (field === "enemyUnitCount") return units.filter(function (unit) { return unit.owner === "ENEMY"; }).length;
    if (field === "playerUnitCount") return units.filter(function (unit) { return unit.owner === "PLAYER"; }).length;
    if (field === "frontlineControlled") return units.some(function (unit) { return unit.owner === "PLAYER" && unit.line === "FRONTLINE"; });
    if (field === "confidence") return state.confidence;
    return null;
}
function compare(actual, operator, expected) {
    if (operator === "EXISTS") return actual != null;
    if (operator === "NOT_EXISTS") return actual == null;
    if (operator === "EQ") return String(actual) === String(expected);
    if (operator === "NE") return String(actual) !== String(expected);
    var a = Number(actual), b = Number(expected); if (!isFinite(a) || !isFinite(b)) return false;
    return operator === "GT" ? a > b : operator === "GTE" ? a >= b : operator === "LT" ? a < b : operator === "LTE" ? a <= b : false;
}
function evaluate(node, state) {
    if (node.type === "priority") { for (var i = 0; i < node.children.length; i++) { var selected = evaluate(node.children[i], state); if (selected) return selected; } return null; }
    if (node.type === "sequence") { for (var j = 0; j < node.children.length; j++) { var action = evaluate(node.children[j], state); if (action) return action; } return null; }
    if (node.type === "condition") return node.whenAll.every(function (p) { return compare(stateValue(state, p.field), p.operator || "EQ", p.value); }) ? evaluate(node.then, state) : null;
    return node.type === "action" ? node.action : null;
}
function load(path) {
    var tree = fallback, source = "内置安全策略";
    try {
        if (path && typeof files !== "undefined" && files.exists(path)) { tree = JSON.parse(files.read(path)); source = path; }
    } catch (e) { return { tree: fallback, source: "内置安全策略", errors: ["读取决策树失败: " + e] }; }
    return { tree: tree, source: source, errors: errors(tree) };
}
function decide(tree, state) { return state && state.scene === domain.Scene.OUR_TURN ? evaluate(tree.root, state) : null; }
module.exports = { load: load, errors: errors, decide: decide, fallback: fallback };
