// Local card catalogue imported from the kards-agent project.
// Recognition code may identify a card by template id or OCR name; this
// module only resolves verified metadata and never invents missing fields.
var cache = null, byName = null, byId = null;

// The catalogue uses data-source names while the vision/strategy layers use
// stable UI labels. Keep rarity normalization separate from foil treatment:
// a golden/foil rendering never changes the card's catalogue rarity.
function normalizeRarity(value) {
    var key = String(value || "").trim().toLowerCase();
    if (key === "standard" || key === "common") return "COMMON";
    if (key === "limited" || key === "rare") return "RARE";
    if (key === "elite") return "ELITE";
    if (key === "special" || key === "legendary") return "SPECIAL";
    return value ? "UNKNOWN" : null;
}

function readJson(path) {
    if (typeof files === "undefined" || !files.exists(path)) return null;
    try { return JSON.parse(files.read(path).replace(/^\uFEFF/, "")); } catch (e) { return null; }
}
function norm(value) { return String(value || "").toLowerCase().replace(/[\s\-.,()（）]/g, ""); }
function add(row, key) {
    if (!row) return;
    var card = {
        id: row.cardId || row.id || key || null,
        name: row.title_zh || row.zhTitle || row.name || row.title_en || null,
        nameEn: row.title_en || row.name || null,
        nation: row.faction || row.nation || null,
        type: row.type || null,
        unitType: row.unitType || null,
        cost: row.kredits !== undefined ? row.kredits : (row.cost !== undefined ? row.cost : null),
        attack: row.attack !== undefined ? row.attack : null,
        defense: row.defense !== undefined ? row.defense : null,
        rarity: normalizeRarity(row.rarity),
        foil: row.foil === true || row.golden === true || row.isFoil === true ? "FOIL" : "UNKNOWN",
        set: row.set || null,
        effect: row.text_zh || row.abilityText || "",
        image: row.image || null,
        source: "kards-agent"
    };
    if (card.id) byId[String(card.id).toLowerCase()] = card;
    if (card.name) byName[norm(card.name)] = card;
    if (card.nameEn) byName[norm(card.nameEn)] = card;
}
function load(config) {
    if (cache) return cache;
    config = config || {};
    var root = config.cardDbRoot || "/sdcard/AutoJs6/KardsScript/autojs";
    byName = {}; byId = {};
    var full = readJson(root + "/data/carddb.json");
    if (full && !Array.isArray(full)) Object.keys(full).forEach(function (key) { add(full[key], key); });
    cache = { byId: byId, byName: byName, size: Object.keys(byId).length };
    return cache;
}
function find(value, config) {
    var db = load(config), key = String(value || "");
    return db.byId[key.toLowerCase()] || db.byName[norm(key)] || null;
}
function findByTemplate(templateId, config) { return find(templateId, config); }
function findByName(name, config) { return find(name, config); }

module.exports = { load: load, find: find, findByTemplate: findByTemplate, findByName: findByName, normalizeRarity: normalizeRarity };
