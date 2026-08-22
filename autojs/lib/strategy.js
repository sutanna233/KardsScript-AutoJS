var domain = require("./domain");
var decision = require("./decision");

function number(value, fallback) { return typeof value === "number" ? value : fallback; }
function pick(items, score) {
    var copy = (items || []).slice();
    copy.sort(function (a, b) { return score(b) - score(a) || String(a.id).localeCompare(String(b.id)); });
    return copy[0] || null;
}
function playable(cards, credits, config) {
    // Never infer affordability.  A drag is permitted only for a card whose
    // individual cost and this turn's available credits are both confirmed.
    return (cards || []).filter(function (c) {
        // A readable cost is not enough: KARDS colours the cost badge orange
        // only when the card is currently affordable/playable. Grey badges
        // must never enter the drag path.
        var badgeOk = config && config.requireCostBadge ? c.costBadgeOrange === true :
            (c.costBadgeOrange === true || (!c.costBadgeOrange && (!c.costBadge || c.costBadge.orange === true)));
        // The badge is the game's live affordability decision. Do not make
        // OCR or the separately-read credit counter a second veto.
        var unitType = ["INFANTRY", "TANK", "ARTILLERY", "FIGHTER", "BOMBER"].indexOf(String(c.type || "UNKNOWN").toUpperCase()) >= 0;
        return c.playable === true && badgeOk && (!(config && config.requireUnitTypeForDeployment === true) || unitType);
    });
}
function isBlocked(item, blockedCardIds) {
    return item && blockedCardIds && blockedCardIds[String(item.id)] === true;
}
function isBlockedUnit(item, blockedUnitIds) {
    return item && blockedUnitIds && blockedUnitIds[String(item.id)] === true;
}
function effectiveUnitType(unit) {
    var type = String(unit && unit.type || "UNKNOWN").toUpperCase();
    return type === "UNKNOWN" ? "INFANTRY" : type;
}
function cardPlayScore(card) {
    // Safety first: card/body confidence is the primary key, followed by the
    // strength of the game's orange affordability signal. Cost and user
    // priority are only tie-breakers; hand position never participates.
    var badgeScore = number(card && card.costBadgeScore,
        number(card && card.costBadge && card.costBadge.score, 0));
    var confirmedCost = card && typeof card.cost === "number" ? 1 : 0;
    return number(card && card.playConfidence, number(card && card.confidence, 0)) * 1000000 +
        badgeScore * 10000 + confirmedCost * 1000 +
        number(card && card.priority, 0) * 10 + number(card && card.cost, 0);
}
function pickPlayableCard(cards, blockedCardIds, config) {
    return pick(playable(cards, null, config).filter(function (card) {
        return !isBlocked(card, blockedCardIds);
    }), cardPlayScore);
}
function guardsHeadquarters(target) {
    return target && target.kind === "ENEMY_UNIT" && (target.isGuard === true || target.guardsHeadquarters === true || (target.tags || []).indexOf("GUARD") >= 0);
}
function targetScore(target) {
    return number(target.threat, 0) * 100 + number(target.attack, 0) * 10 - number(target.defense, 0);
}
function chooseTarget(targets, options, actionKind, source) {
    var legal = (targets || []).filter(function (t) { return t.legal && t.bounds; });
    // Playing a card can only consume a measured empty friendly deployment
    // area. In particular, end-turn and enemy HQ are never valid fallbacks
    // for an unfinished card play.
    if (actionKind === domain.Action.PLAY_CARD || actionKind === domain.Action.MOVE_TO_FRONTLINE) {
        return pick(legal.filter(function (target) { return target.kind === "FRIENDLY_UNIT"; }), targetScore);
    }
    // Ordinary unit attacks are enemy-directed; no miscellaneous UI control
    // (notably END_TURN) may be selected while an attack is pending.
    // OPERATE_UNIT is an attack-like action once a frontline unit is chosen;
    // it must never consume a friendly unit as its destination.  The only
    // friendly destination is synthesized separately for MOVE_TO_FRONTLINE.
    if (actionKind === domain.Action.ATTACK || actionKind === domain.Action.OPERATE_UNIT) {
        legal = legal.filter(function (target) { return target.kind === "ENEMY_UNIT" || target.kind === "ENEMY_HQ"; });
    }
    // Confirmed air/artillery rules. Unknown types deliberately fall back to
    // the generic guard/frontline ordering below.
    var sourceType = source && String(source.type || "").toUpperCase();
    var supportFighter = legal.some(function (target) {
        return target.kind === "ENEMY_UNIT" && target.isFrontline !== true && String(target.type || "").toUpperCase() === "FIGHTER";
    });
    if (sourceType === "BOMBER" && !supportFighter) {
        var bomberHq = legal.filter(function (target) { return target.kind === "ENEMY_HQ"; });
        if (bomberHq.length) return pick(bomberHq, targetScore);
    }
    if (sourceType === "BOMBER" && supportFighter) {
        legal = legal.filter(function (target) { return target.kind !== "ENEMY_HQ"; });
    }
    if (sourceType === "ARTILLERY") {
        var artilleryHq = legal.filter(function (target) { return target.kind === "ENEMY_HQ"; });
        if (artilleryHq.length) return pick(artilleryHq, targetScore);
    }
    // A confirmed guard must be attacked before the headquarters.  This is
    // intentionally based on visual metadata only; an unconfirmed unit is
    // never promoted to a guard by position or card art alone.
    var guards = legal.filter(guardsHeadquarters);
    var frontlineGuards = guards.filter(function (target) { return target.isFrontline === true; });
    if (frontlineGuards.length) return pick(frontlineGuards, targetScore);
    if (guards.length) return pick(guards, targetScore);
    var frontline = legal.filter(function (target) { return target.kind === "ENEMY_UNIT" && target.isFrontline === true; });
    if (options && options.preferFrontlineUnits === true && frontline.length) return pick(frontline, targetScore);
    var headquarters = legal.filter(function (t) { return t.kind === "ENEMY_HQ"; });
    return headquarters.length ? pick(headquarters, targetScore) : pick(legal, targetScore);
}
function heuristic(state, config) {
    if (!state || state.scene !== domain.Scene.OUR_TURN) return null;
    // 不假设手牌按费用或位置排序。先选择视觉置信度最高且费用徽章
    // 确认为橙色的牌，费用/用户优先级只在视觉证据相同时参与排序。
    var card = pickPlayableCard(state.hand, state.blockedCardIds, config);
    if (card) return { kind: domain.Action.PLAY_CARD, sourceId: card.id, confidence: number(card.confidence, 0) };
    var unit = pick((state.units || []).filter(function (u) { return u.owner === "PLAYER" && u.canOperate && !isBlockedUnit(u, state.blockedUnitIds); }), function (u) { return number(u.attack, 0) * 10 - number(u.defense, 0); });
    var rearUnit = pick((state.units || []).filter(function (u) { return u.owner === "PLAYER" && u.canOperate && u.isFrontline !== true && !isBlockedUnit(u, state.blockedUnitIds); }), function (u) { return number(u.attack, 0) * 10 - number(u.defense, 0); });
    var enemyFrontline = (state.units || []).some(function (u) { return u.owner === "ENEMY" && u.isFrontline === true; });
    var rearType = rearUnit && effectiveUnitType(rearUnit);
    var supportAttacker = ["ARTILLERY", "FIGHTER", "BOMBER"].indexOf(rearType) >= 0;
    if (rearUnit && (enemyFrontline || supportAttacker)) return { kind: domain.Action.ATTACK, sourceId: rearUnit.id, confidence: number(rearUnit.confidence, 0) };
    if (rearUnit && ["TANK", "INFANTRY"].indexOf(rearType) >= 0) return { kind: domain.Action.MOVE_TO_FRONTLINE, sourceId: rearUnit.id, confidence: number(rearUnit.confidence, 0) };
    if (unit) return { kind: domain.Action.ATTACK, sourceId: unit.id, confidence: number(unit.confidence, 0) };
    return { kind: domain.Action.END_TURN, confidence: 1 };
}

function create(config) {
    var loaded = decision.load(config && config.decisionTreePath);
    function decidePlan(state) {
        var action = loaded.errors.length ? null : decision.decide(loaded.tree, state);
        if (!action) return heuristic(state, config);
        if (action.kind === domain.Action.END_TURN) return { kind: action.kind, confidence: 1, targetSort: action.targetSort || [] };
        var candidates = action.kind === domain.Action.PLAY_CARD ? playable(state.hand, state.credits, config).filter(function (card) { return !isBlocked(card, state.blockedCardIds); }) : (state.units || []).filter(function (unit) { return unit.owner === "PLAYER" && unit.canOperate && !isBlockedUnit(unit, state.blockedUnitIds); });
        var source = action.kind === domain.Action.PLAY_CARD ? pick(candidates, cardPlayScore) :
            pick(candidates, function (item) { return number(item.priority, 0) * 100 + number(item.attack, 0) * 10 + number(item.cost, 0); });
        if (source) {
            // A rear unit cannot attack the opposing rear/frontline target in
            // this build until it first captures the frontline. Convert the
            // generic OPERATE_UNIT action into an explicit move; the runtime
            // performs a bounded drag to an observed empty frontline slot.
            var sourceType = effectiveUnitType(source);
            var canAttackFromSupport = ["ARTILLERY", "FIGHTER", "BOMBER"].indexOf(sourceType) >= 0 ||
                (state.units || []).some(function (unit) { return unit.owner === "ENEMY" && unit.isFrontline === true; });
            // A rear unit may be moved to the frontline only when its ground
            // role is identified, or temporarily falls back to infantry by
            // the user-confirmed rule for unknown board units.
            var confirmedGround = ["TANK", "INFANTRY"].indexOf(sourceType) >= 0;
            if ((action.kind === domain.Action.OPERATE_UNIT || action.kind === domain.Action.ATTACK) && source.owner === "PLAYER" && source.isFrontline !== true && !canAttackFromSupport) {
                if (!confirmedGround) return { kind: domain.Action.END_TURN, confidence: 1, targetSort: action.targetSort || [] };
                return { kind: domain.Action.MOVE_TO_FRONTLINE, sourceId: source.id, confidence: number(source.confidence, 0), targetSort: action.targetSort || [] };
            }
            if ((action.kind === domain.Action.OPERATE_UNIT || action.kind === domain.Action.ATTACK) && canAttackFromSupport) {
                return { kind: domain.Action.ATTACK, sourceId: source.id, confidence: number(source.confidence, 0), targetSort: action.targetSort || [] };
            }
            return { kind: action.kind, sourceId: source.id, confidence: number(source.confidence, 0), targetSort: action.targetSort || [] };
        }
        // The decision tree can still report hasPlayableCard while every
        // candidate is quarantined after a failed deployment. Re-enter the
        // safe heuristic so an operable unit can act, or the turn can end;
        // never leave the runtime spinning on a no-op PLAY_CARD plan.
        return heuristic(state, config);
    }
    return { decide: decidePlan, chooseTarget: function (targets, actionKind, source) { return chooseTarget(targets, config, actionKind, source); }, validationErrors: loaded.errors, source: loaded.source };
}

module.exports = { create: create, decide: heuristic, chooseTarget: chooseTarget, pickPlayableCard: pickPlayableCard,
    _private: { guardsHeadquarters: guardsHeadquarters, playable: playable, cardPlayScore: cardPlayScore, pickPlayableCard: pickPlayableCard } };
