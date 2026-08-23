// User-editable strategy preferences. This module deliberately exposes a
// small, bounded surface and compiles it to the existing decision-tree DSL;
// no user supplied JavaScript or screen coordinates are executed.
var ACTIONS = { PLAY_CARD: true, OPERATE_UNIT: true, END_TURN: true };
var CARD_PREFERENCES = { VISUAL_CONFIDENCE: true, HIGH_COST: true, LOW_COST: true };
var MODE_TYPES = { training: true, casual: true, ranked: true };
// 安全默认值：这些参数即使被用户覆盖也会被钳制到安全范围。
// 置信度门槛、稳定帧数、安全保护不允许用户关闭。
var SAFE = {
    minUiConfidence: 0.80,
    minTargetConfidence: 0.70,
    minStableHandFrames: 2,
    minUnitActionConfidence: 0.55,
    maxSameSceneFrames: 160,
    opponentTurnTimeoutMs: 90000,
    maxConsecutiveFailures: 4,
    requireCostBadge: true,
    detectGenericBlockingOverlay: false
};
// 节奏参数的安全下限：低于此值会导致操作过于频繁，可能被游戏拒绝或造成误操作。
var PACE_MIN = {
    cardPlayPaceMs: 300,
    unitActionPaceMs: 300,
    endTurnPaceMs: 500,
    navPaceMs: 800
};
var PACE_MAX = {
    cardPlayPaceMs: 5000,
    unitActionPaceMs: 5000,
    endTurnPaceMs: 10000,
    navPaceMs: 10000
};
var DEFAULT = {
    schemaVersion: 1,
    name: "基础策略",
    actionOrder: ["OPERATE_UNIT", "PLAY_CARD", "END_TURN"],
    cardPreference: "VISUAL_CONFIDENCE",
    preferFrontlineUnits: true,
    maxCardPlaysPerTurn: 3,
    maxUnitActionAttemptsPerUnit: 2,
    modeType: "training",
    cardPlayPaceMs: 750,
    unitActionPaceMs: 650,
    endTurnPaceMs: 1100,
    navPaceMs: 1800
};

function storageCandidates(preferred) {
    var result = [], seen = {};
    function add(path) { if (path && !seen[path]) { seen[path] = true; result.push(path); } }
    // 旧版本公共目录在 Android 11+ 可能被分区存储拒绝；保留它作为
    // 首选读取/迁移来源，但保存时会自动回退到应用私有目录。
    add(preferred);
    try {
        if (typeof context !== "undefined" && context.getFilesDir) {
            var privateDir = String(context.getFilesDir().getAbsolutePath());
            add(privateDir + "/user-strategy.json");
        }
    } catch (_) {}
    try {
        if (typeof files !== "undefined" && files.cwd) add(files.join(files.cwd(), "user-strategy.json"));
    } catch (_) {}
    // 导入 Auto.js 项目时该目录通常可写，作为最后的兼容位置。
    add("/sdcard/AutoJs6/KardsScript/user-strategy.json");
    return result;
}
function storagePath(preferred) {
    return storageCandidates(preferred)[0];
}
function copy(value) { return JSON.parse(JSON.stringify(value)); }
function integer(value, fallback, min, max) {
    value = Number(value);
    if (!isFinite(value)) value = fallback;
    return Math.max(min, Math.min(max, Math.round(value)));
}
function errors(value) {
    var result = [];
    if (!value || typeof value !== "object") return ["配置必须是对象"];
    if (value.schemaVersion != null && Number(value.schemaVersion) !== 1) result.push("仅支持 schemaVersion=1");
    if (value.actionOrder != null) {
        if (!Array.isArray(value.actionOrder) || !value.actionOrder.length) result.push("行动顺序不能为空");
        else {
            var seen = {};
            value.actionOrder.forEach(function (action) {
                if (!ACTIONS[action]) result.push("未知行动: " + action);
                if (seen[action]) result.push("行动不能重复: " + action);
                seen[action] = true;
            });
            if (value.actionOrder.indexOf("END_TURN") < 0) result.push("行动顺序必须包含 END_TURN");
        }
    }
    if (value.cardPreference != null && !CARD_PREFERENCES[value.cardPreference]) result.push("未知出牌偏好");
    if (value.modeType != null && !MODE_TYPES[value.modeType]) result.push("未知对局模式: " + value.modeType);
    ["maxCardPlaysPerTurn", "maxUnitActionAttemptsPerUnit"].forEach(function (field) {
        if (value[field] != null && (!isFinite(Number(value[field])) || Number(value[field]) < 1 || Number(value[field]) > 3)) {
            result.push(field + " 必须是 1 到 3 的整数");
        }
    });
    ["cardPlayPaceMs", "unitActionPaceMs", "endTurnPaceMs", "navPaceMs"].forEach(function (field) {
        if (value[field] != null && (!isFinite(Number(value[field])) || Number(value[field]) < PACE_MIN[field] || Number(value[field]) > PACE_MAX[field])) {
            result.push(field + " 必须在 " + PACE_MIN[field] + " 到 " + PACE_MAX[field] + " 毫秒之间");
        }
    });
    return result;
}
function normalize(value) {
    value = value || {};
    var result = copy(DEFAULT);
    result.name = typeof value.name === "string" && value.name.trim() ? value.name.trim().slice(0, 40) : result.name;
    if (Array.isArray(value.actionOrder) && !errors({ actionOrder: value.actionOrder }).length) result.actionOrder = value.actionOrder.slice();
    if (CARD_PREFERENCES[value.cardPreference]) result.cardPreference = value.cardPreference;
    if (typeof value.preferFrontlineUnits === "boolean") result.preferFrontlineUnits = value.preferFrontlineUnits;
    result.maxCardPlaysPerTurn = integer(value.maxCardPlaysPerTurn, result.maxCardPlaysPerTurn, 1, 3);
    result.maxUnitActionAttemptsPerUnit = integer(value.maxUnitActionAttemptsPerUnit, result.maxUnitActionAttemptsPerUnit, 1, 3);
    if (MODE_TYPES[value.modeType]) result.modeType = value.modeType;
    ["cardPlayPaceMs", "unitActionPaceMs", "endTurnPaceMs", "navPaceMs"].forEach(function (field) {
        result[field] = integer(value[field], result[field], PACE_MIN[field], PACE_MAX[field]);
    });
    return result;
}
function actionNode(kind) {
    if (kind === "END_TURN") return { id: "user-end-turn", type: "action", action: { kind: "END_TURN" } };
    var field = kind === "PLAY_CARD" ? "hasPlayableCard" : "hasOperableUnit";
    return {
        id: "user-" + kind.toLowerCase(), type: "condition",
        whenAll: [{ field: field, operator: "EQ", value: "true" }],
        then: { id: "user-" + kind.toLowerCase() + "-action", type: "action", action: { kind: kind, legalOnly: true } }
    };
}
function toDecisionTree(preferences) {
    var strategy = normalize(preferences);
    return {
        schemaVersion: 1,
        name: strategy.name,
        root: { id: "user-root", type: "priority", children: strategy.actionOrder.map(actionNode) }
    };
}
function apply(config, preferences) {
    var strategy = normalize(preferences);
    config.decisionTreeOverride = toDecisionTree(strategy);
    config.cardPreference = strategy.cardPreference;
    config.preferFrontlineUnits = strategy.preferFrontlineUnits;
    config.maxPlayAttemptsPerTurn = strategy.maxCardPlaysPerTurn;
    config.maxUnitActionAttemptsPerUnit = strategy.maxUnitActionAttemptsPerUnit;
    config.modeType = strategy.modeType;
    config.cardPlayPaceMs = strategy.cardPlayPaceMs;
    config.unitActionPaceMs = strategy.unitActionPaceMs;
    config.endTurnPaceMs = strategy.endTurnPaceMs;
    config.navPaceMs = strategy.navPaceMs;
    // 安全项：无论用户策略如何配置，这些保护值始终从 SAFE 强制写入。
    Object.keys(SAFE).forEach(function (key) { config[key] = SAFE[key]; });
    return strategy;
}
function read(path) {
    if (typeof files === "undefined") return { preferences: copy(DEFAULT), source: "默认配置", errors: [] };
    var candidates = storageCandidates(path), lastError = null;
    for (var i = 0; i < candidates.length; i++) {
        if (!files.exists(candidates[i])) continue;
        try {
            var parsed = JSON.parse(files.read(candidates[i]));
            var validationErrors = errors(parsed);
            return { preferences: validationErrors.length ? copy(DEFAULT) : normalize(parsed), source: candidates[i], errors: validationErrors };
        } catch (e) { lastError = e; }
    }
    return { preferences: copy(DEFAULT), source: "默认配置", errors: lastError ? ["读取配置失败: " + lastError] : [] };
}
function write(path, preferences) {
    var validationErrors = errors(preferences);
    if (validationErrors.length) return { ok: false, errors: validationErrors };
    if (typeof files === "undefined") return { ok: false, errors: ["当前环境不支持文件保存"] };
    var payload = JSON.stringify(normalize(preferences), null, 2), candidates = storageCandidates(path), failures = [];
    for (var i = 0; i < candidates.length; i++) {
        try {
            // Android 11+ may reject the legacy public /sdcard/KardsScript path
            // with EPERM. Try it for backward compatibility, then fall back to
            // the app-private files directory or the imported project directory.
            files.ensureDir(candidates[i]);
            files.write(candidates[i], payload);
            return { ok: true, path: candidates[i], preferences: normalize(preferences) };
        } catch (e) { failures.push(candidates[i] + ": " + e); }
    }
    return { ok: false, errors: ["保存配置失败：所有可写目录均被拒绝", failures.join("\n")] };
}

module.exports = { DEFAULT: DEFAULT, SAFE: SAFE, PACE_MIN: PACE_MIN, PACE_MAX: PACE_MAX, errors: errors, normalize: normalize, toDecisionTree: toDecisionTree, apply: apply, read: read, write: write };
