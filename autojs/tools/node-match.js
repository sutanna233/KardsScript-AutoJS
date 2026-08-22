/*
 * 纯 Node 模板匹配（模拟 Auto.js images.findImage）
 * 滑动窗口 + 归一化均方误差 (NMSE)。返回最匹配位置及其相似度。
 * 用法: node autojs/tools/node-match.js <截图.png> <模板.png> [阈值]
 */

var path = require("path");
var png = require("./png-decode");

function matchTemplate(image, template, threshold) {
    var W = image.getWidth(), H = image.getHeight();
    var tw = template.getWidth(), th = template.getHeight();
    if (tw > W || th > H) return null;

    // 预取模板像素
    var t = [];
    for (var ty = 0; ty < th; ty++) for (var tx = 0; tx < tw; tx++) t.push(template.pixel(tx, ty) >>> 0);

    var bestMse = Infinity, bestX = Math.floor((W - tw) / 2), bestY = Math.floor((H - th) / 2);

    // 三级金字塔扫描：粗→中→细
    var levels = [
        { step: 20, span: Infinity },   // 1. 全局粗扫
        { step: 5, span: 80 },          // 2. 在中距离精扫
        { step: 1, span: 12 }           // 3. 近距精扫
    ];

    levels.forEach(function (lv) {
        var sx0 = Math.max(0, bestX - lv.span), sy0 = Math.max(0, bestY - lv.span);
        var sx1 = Math.min(W - tw, bestX + lv.span), sy1 = Math.min(H - th, bestY + lv.span);
        for (var y = sy0; y <= sy1; y += lv.step) {
            for (var x = sx0; x <= sx1; x += lv.step) {
                var mse = mseAt(image, x, y, tw, th, t);
                if (mse < bestMse) { bestMse = mse; bestX = x; bestY = y; }
            }
        }
    });

    // 相似度转 Auto.js threshold 语义（0~1）
    var similarity = 1 - bestMse;
    var ok = similarity >= (threshold !== undefined ? threshold : 0.8);
    return { x: bestX, y: bestY, width: tw, height: th, similarity: similarity, ok: ok };
}

function mseAt(image, x, y, tw, th, t) {
    var sum = 0, n = 0;
    for (var ty = 0; ty < th; ty++) {
        for (var tx = 0; tx < tw; tx++) {
            var a = image.pixel(x + tx, y + ty) >>> 0;
            var b = t[ty * tw + tx];
            var ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
            var br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
            sum += (ar - br) * (ar - br) + (ag - bg) * (ag - bg) + (ab - bb) * (ab - bb);
            n += 3;
        }
    }
    return sum / n / (255 * 255); // 归一化 MSE ∈ [0,1]
}

var args = process.argv.slice(2);
if (args.length >= 2) {
    var image = png.decodePng(path.resolve(args[0]));
    var template = png.decodePng(path.resolve(args[1]));
    var threshold = args[2] !== undefined ? parseFloat(args[2]) : 0.8;
    var result = matchTemplate(image, template, threshold);
    if (result) {
        console.log("模板 " + path.basename(args[1]) + " 在 " + path.basename(args[0]) +
            " 中: 位置(" + result.x + "," + result.y + ") 尺寸" + result.width + "x" + result.height +
            " 相似度=" + result.similarity.toFixed(3) + " (" + (result.ok ? "命中" : "未达阈值") + ")");
    } else {
        console.log("模板过大或未找到");
    }
}

module.exports = { matchTemplate: matchTemplate, mseAt: mseAt };