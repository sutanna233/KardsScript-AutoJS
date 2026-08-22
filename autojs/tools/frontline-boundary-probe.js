var png = require("./png-decode");

function luma(c) {
    return (((c >>> 16) & 255) * 0.299) + (((c >>> 8) & 255) * 0.587) + ((c & 255) * 0.114);
}

function probe(path) {
    var image = png.decodePng(path), w = image.getWidth(), h = image.getHeight(), rows = [];
    for (var y = Math.round(h * 0.25); y <= Math.round(h * 0.68); y += 2) {
        var score = 0, hits = 0, count = 0;
        for (var x = Math.round(w * 0.20); x < Math.round(w * 0.82); x += 8) {
            var delta = Math.abs(luma(image.pixel(x, y - 4)) - luma(image.pixel(x, y + 4)));
            score += delta;
            if (delta >= 18) hits++;
            count++;
        }
        rows.push({ y: y, score: hits / Math.max(1, count) * 100 + score / Math.max(1, count) * 0.25 });
    }
    rows.sort(function (a, b) { return b.score - a.score; });
    console.log(path + " " + rows.slice(0, 8).map(function (r) { return r.y + ":" + r.score.toFixed(1); }).join(" "));
}

process.argv.slice(2).forEach(probe);
