/*
 * Compare the top-left action-cost pocket of detected player units across
 * real screenshots. Usage:
 *   node autojs/tools/debug-unit-action-cost.js fixtures/a.png fixtures/b.png
 */
var path = require("path");
var png = require("./png-decode");
var vision = require("../lib/vision");
var config = require("../lib/config");

function report(file) {
    var image = png.decodePng(path.resolve(file));
    var observation = vision.create(config).observe(image);
    console.log("=== " + file + " " + observation.scene.scene + " ===");
    (observation.state.units || []).filter(function (unit) { return unit.owner === "PLAYER"; }).forEach(function (unit) {
        var b = unit.bounds, w = image.getWidth(), h = image.getHeight();
        var x1 = Math.floor(b[0] * w), y1 = Math.floor(b[1] * h);
        var x2 = Math.floor((b[0] + (b[2] - b[0]) * 0.28) * w);
        var y2 = Math.floor((b[1] + (b[3] - b[1]) * 0.22) * h);
        var total = 0, sumR = 0, sumG = 0, sumB = 0;
        var strict = 0, warm10 = 0, warm20 = 0, amber = 0;
        for (var y = y1; y < y2; y += 2) for (var x = x1; x < x2; x += 2) {
            var c = image.pixel(x, y) >>> 0;
            var r = (c >>> 16) & 255, g = (c >>> 8) & 255, bl = c & 255;
            total++; sumR += r; sumG += g; sumB += bl;
            if (r >= 170 && r - g >= 50 && g - bl >= 25) strict++;
            if (r >= 90 && r - g >= 10 && g - bl >= 8) warm10++;
            if (r >= 100 && r - g >= 20 && g - bl >= 12) warm20++;
            if (r >= 110 && g >= 60 && r - bl >= 45 && g - bl >= 20) amber++;
        }
        function ratio(n) { return total ? (n / total).toFixed(4) : "0"; }
        console.log(JSON.stringify({ id: unit.id, bounds: unit.bounds,
            avg: total ? [sumR / total, sumG / total, sumB / total].map(function (n) { return Number(n.toFixed(1)); }) : [],
            strict: ratio(strict), warm10: ratio(warm10), warm20: ratio(warm20), amber: ratio(amber),
            current: vision._private.detectOrangeMoveCost(image, unit.bounds) }));
    });
}

process.argv.slice(2).forEach(report);
