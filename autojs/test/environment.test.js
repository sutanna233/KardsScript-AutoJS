var assert = require("assert");
var environment = require("../lib/environment");

function frame(width, height) {
    return { getWidth: function () { return width; }, getHeight: function () { return height; } };
}

function inspect(width, height, runtime) {
    return environment.inspect({ environment: { expectedWidth: 1280, expectedHeight: 720, aspectTolerance: 0.015 } }, frame(width, height), runtime || { rootInput: { available: true } });
}

var exact = inspect(1280, 720);
assert.strictEqual(exact.safeForActions, true);
assert.strictEqual(exact.capture.exactSize, true);
assert.strictEqual(exact.issues.length, 0);

var scaled = inspect(1920, 1080);
assert.strictEqual(scaled.safeForActions, false);
assert.ok(scaled.issues.some(function (item) { return item.code === "capture-size-mismatch"; }));
assert.strictEqual(scaled.capture.exactAspect, true);

var portrait = inspect(720, 1280);
assert.strictEqual(portrait.safeForActions, false);
assert.ok(portrait.issues.some(function (item) { return item.code === "aspect-ratio-mismatch"; }));

var noRoot = inspect(1280, 720, { rootInput: { available: false } });
assert.strictEqual(noRoot.safeForActions, false);
assert.ok(noRoot.issues.some(function (item) { return item.code === "root-input-unavailable"; }));

var malformed = environment.inspect({}, null, { rootInput: { available: true } });
assert.strictEqual(malformed.safeForActions, false);
assert.ok(malformed.issues.some(function (item) { return item.code === "capture-unreadable"; }));

console.log("environment tests passed");
