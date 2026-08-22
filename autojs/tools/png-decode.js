/*
 * 纯 Node.js PNG 解码器（无第三方依赖）
 * 仅支持 8bit RGB/RGBA/灰度/灰度+alpha 的 PNG（KARDS 截图是 32bpp ARGB，即 RGBA 8bit）
 * 输出模拟 Auto.js ImageWrapper：{ getWidth(), getHeight(), pixel(x,y) -> signed ARGB int }
 */
var zlib = require("zlib");

function readUint32(buf, off) {
    return (buf[off] << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3];
}

function decodePng(filePath) {
    var fs = require("fs");
    var data = fs.readFileSync(filePath);
    if (data.length < 8 || data.readUInt32BE(0) !== 0x89504e47) throw new Error("不是 PNG 文件: " + filePath);

    var pos = 8;
    var width = 0, height = 0, bitDepth = 0, colorType = 0;
    var idatChunks = [];

    while (pos < data.length) {
        var length = data.readUInt32BE(pos);
        var type = data.toString("ascii", pos + 4, pos + 8);
        var chunkData = data.slice(pos + 8, pos + 8 + length);
        if (type === "IHDR") {
            width = readUint32(chunkData, 0);
            height = readUint32(chunkData, 4);
            bitDepth = chunkData[8];
            colorType = chunkData[9];
            if (bitDepth !== 8) throw new Error("仅支持 8bit PNG，实际 bitDepth=" + bitDepth);
        } else if (type === "IDAT") {
            idatChunks.push(chunkData);
        } else if (type === "IEND") {
            break;
        }
        pos += 12 + length;
    }

    if (!width || !height) throw new Error("PNG 缺少 IHDR");
    var channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : colorType === 4 ? 2 : 0;
    if (!channels) throw new Error("不支持的颜色类型: " + colorType);

    var raw = zlib.inflateSync(Buffer.concat(idatChunks));
    var stride = width * channels;
    var pixels = Buffer.alloc(width * height * 4); // 统一转 RGBA

    // 逐行反滤波
    var rowBytes = stride;
    var prev = Buffer.alloc(rowBytes);
    var offset = 0;
    for (var y = 0; y < height; y++) {
        var filterType = raw[offset];
        offset++;
        var row = raw.slice(offset, offset + rowBytes);
        offset += rowBytes;

        var reconstructed = Buffer.alloc(rowBytes);
        var fromPrev, left, up, upLeft;

        switch (filterType) {
            case 0: // None
                row.copy(reconstructed);
                break;
            case 1: // Sub
                for (var i = 0; i < rowBytes; i++) {
                    left = i >= channels ? reconstructed[i - channels] : 0;
                    reconstructed[i] = (row[i] + left) & 0xff;
                }
                break;
            case 2: // Up
                for (var i = 0; i < rowBytes; i++) {
                    up = prev[i];
                    reconstructed[i] = (row[i] + up) & 0xff;
                }
                break;
            case 3: // Average
                for (var i = 0; i < rowBytes; i++) {
                    left = i >= channels ? reconstructed[i - channels] : 0;
                    up = prev[i];
                    reconstructed[i] = (row[i] + Math.floor((left + up) / 2)) & 0xff;
                }
                break;
            case 4: // Paeth
                for (var i = 0; i < rowBytes; i++) {
                    left = i >= channels ? reconstructed[i - channels] : 0;
                    up = prev[i];
                    upLeft = i >= channels ? prev[i - channels] : 0;
                    var p = left + up - upLeft;
                    var pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upLeft);
                    var pred = (pa <= pb && pa <= pc) ? left : (pb <= pc ? up : upLeft);
                    reconstructed[i] = (row[i] + pred) & 0xff;
                }
                break;
            default:
                throw new Error("未知滤波类型: " + filterType);
        }

        // 转 RGBA 输出
        for (var x = 0; x < width; x++) {
            var src = x * channels;
            var dst = (y * width + x) * 4;
            if (colorType === 6) { // RGBA
                pixels[dst] = reconstructed[src];
                pixels[dst + 1] = reconstructed[src + 1];
                pixels[dst + 2] = reconstructed[src + 2];
                pixels[dst + 3] = reconstructed[src + 3];
            } else if (colorType === 2) { // RGB → alpha=255
                pixels[dst] = reconstructed[src];
                pixels[dst + 1] = reconstructed[src + 1];
                pixels[dst + 2] = reconstructed[src + 2];
                pixels[dst + 3] = 255;
            } else if (colorType === 0) { // 灰度 → RGB 相同
                pixels[dst] = pixels[dst + 1] = pixels[dst + 2] = reconstructed[src];
                pixels[dst + 3] = 255;
            } else { // 灰度+alpha
                pixels[dst] = pixels[dst + 1] = pixels[dst + 2] = reconstructed[src];
                pixels[dst + 3] = reconstructed[src + 1];
            }
        }
        reconstructed.copy(prev);
    }

    // 返回模拟 ImageWrapper：pixel(x,y) 返回带符号 ARGB int
    return {
        _width: width,
        _height: height,
        _pixels: pixels,
        getWidth: function () { return width; },
        getHeight: function () { return height; },
        pixel: function (x, y) {
            var i = (y * width + x) * 4;
            var a = pixels[i + 3], r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
            // signed 32-bit: 若 alpha>=128 则高位为1 → 负数
            return ((a << 24) | (r << 16) | (g << 8) | b) | 0;
        }
    };
}

module.exports = { decodePng: decodePng };