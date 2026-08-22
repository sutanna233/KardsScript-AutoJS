// Offline comparison of broad vs unit-corner guard-template search regions.
// Uses real screenshots and the pure-Node matcher; never labels by colour.
var png = require("./png-decode");
var matcher = require("./node-match");
var vision = require("../lib/vision");
var config = require("../lib/config");

var fixtures = process.argv.slice(2);
if (!fixtures.length) fixtures = [
    "fixtures/guard-live-current.png",
    "fixtures/performance-probe-current-screen.png",
    "fixtures/auto-run-after-stop.png"
];
var template = png.decodePng("autojs/templates/buttons/guard-marker-enemy.png");

function crop(image, bounds) {
    var w = image.getWidth(), h = image.getHeight();
    var x0 = Math.max(0, Math.floor(bounds[0] * w));
    var y0 = Math.max(0, Math.floor(bounds[1] * h));
    var x1 = Math.min(w, Math.ceil(bounds[2] * w));
    var y1 = Math.min(h, Math.ceil(bounds[3] * h));
    return {
        x0: x0, y0: y0,
        getWidth: function () { return x1 - x0; },
        getHeight: function () { return y1 - y0; },
        pixel: function (x, y) { return image.pixel(x0 + x, y0 + y); }
    };
}
function tight(unitBounds) {
    return [
        Math.max(0, unitBounds[2] - 0.018),
        Math.max(0, unitBounds[1] - 0.012),
        Math.min(1, unitBounds[2] + 0.030),
        Math.min(1, unitBounds[1] + 0.085)
    ];
}
fixtures.forEach(function (file) {
    var image = png.decodePng(file);
    var observation = vision.create(config).observe(image);
    var rows = observation.state.units.filter(function (unit) { return unit.owner === "ENEMY"; }).map(function (unit) {
        var broadBounds = vision._private.guardIconBounds(unit.bounds);
        var tightBounds = tight(unit.bounds);
        var broadCrop = crop(image, broadBounds), tightCrop = crop(image, tightBounds);
        var broad = matcher.matchTemplate(broadCrop, template, 0);
        var corner = matcher.matchTemplate(tightCrop, template, 0);
        return {
            id: unit.id, unitBounds: unit.bounds,
            broad: broad ? { similarity: Number(broad.similarity.toFixed(4)), x: broadCrop.x0 + broad.x, y: broadCrop.y0 + broad.y } : null,
            tight: corner ? { similarity: Number(corner.similarity.toFixed(4)), x: tightCrop.x0 + corner.x, y: tightCrop.y0 + corner.y } : null
        };
    });
    console.log(JSON.stringify({ fixture: file, rows: rows }));
});
