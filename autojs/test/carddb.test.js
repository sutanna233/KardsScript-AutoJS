var assert = require("assert");
var carddb = require("../lib/carddb");

assert.strictEqual(carddb.normalizeRarity("Standard"), "COMMON");
assert.strictEqual(carddb.normalizeRarity("Limited"), "RARE");
assert.strictEqual(carddb.normalizeRarity("Elite"), "ELITE");
assert.strictEqual(carddb.normalizeRarity("Special"), "SPECIAL");
assert.strictEqual(carddb.normalizeRarity("unknown-source-value"), "UNKNOWN");
assert.strictEqual(carddb.normalizeRarity(null), null);
console.log("carddb rarity normalization ok");
