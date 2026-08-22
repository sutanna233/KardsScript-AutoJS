/*
 * Offline card appearance probe.
 * Usage:
 *   node card-appearance-probe.js <png> <x1,y1,x2,y2> [label]
 * Bounds are pixel coordinates in the supplied screenshot.  The output is
 * diagnostic only; it never labels rarity or foil without a calibrated pair.
 */
var fs = require("fs");
var decoder = require("./png-decode");
var file = process.argv[2] || "fixtures/visual-calibration-current.png";
var rawBounds = process.argv[3] || "300,430,405,585";
var label = process.argv[4] || "unlabelled";
var b = rawBounds.split(",").map(Number);
if (b.length !== 4 || b.some(function (v) { return !isFinite(v); })) throw new Error("bounds must be x1,y1,x2,y2");
var image = decoder.decodePng(file), w = image.getWidth(), h = image.getHeight();
var x0 = Math.max(0, Math.min(w - 1, Math.floor(b[0]))), y0 = Math.max(0, Math.min(h - 1, Math.floor(b[1])));
var x1 = Math.max(x0 + 1, Math.min(w, Math.ceil(b[2]))), y1 = Math.max(y0 + 1, Math.min(h, Math.ceil(b[3])));
var n = 0, sumL = 0, sumL2 = 0, gold = 0, bright = 0, edges = 0, samples = [];
function rgb(c) { return { r: (c >>> 16) & 255, g: (c >>> 8) & 255, b: c & 255 }; }
function lum(p) { return 0.2126 * p.r + 0.7152 * p.g + 0.0722 * p.b; }
for (var y = y0; y < y1; y += 3) for (var x = x0; x < x1; x += 3) {
    var p = rgb(image.pixel(x, y)), l = lum(p), max = Math.max(p.r, p.g, p.b), min = Math.min(p.r, p.g, p.b);
    n++; sumL += l; sumL2 += l * l;
    if (p.r > 105 && p.g > 82 && p.r > p.b * 1.25 && p.g > p.b * 1.12) gold++;
    if (max > 205) bright++;
    if (x + 3 < x1) {
        var q = rgb(image.pixel(x + 3, y));
        if (Math.abs(l - lum(q)) > 42) edges++;
    }
    if (samples.length < 12 && (n % 17 === 0)) samples.push({ x: x, y: y, r: p.r, g: p.g, b: p.b });
}
var meanL = sumL / Math.max(1, n);
var result = {
    file: file, label: label, bounds: [x0, y0, x1, y1], pixels: n,
    meanL: Number(meanL.toFixed(3)), luminanceVariance: Number((sumL2 / Math.max(1, n) - meanL * meanL).toFixed(3)),
    goldRatio: Number((gold / Math.max(1, n)).toFixed(5)), brightRatio: Number((bright / Math.max(1, n)).toFixed(5)),
    edgeRatio: Number((edges / Math.max(1, n)).toFixed(5)), samples: samples,
    classification: { rarity: "UNKNOWN", foil: "UNKNOWN" }
};
console.log(JSON.stringify(result, null, 2));
