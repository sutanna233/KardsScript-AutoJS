var config = require("./lib/config");
var out = "/sdcard/AutoJs6/KardsScript/live-ocr-debug.json";
auto.waitFor();
if (!requestScreenCapture(true)) { files.write(out, JSON.stringify({ error: "capture" })); exit(); }
var image = captureScreen(), w = image.getWidth(), h = image.getHeight();
function read(bounds) {
    var x = Math.round(bounds[0] * w), y = Math.round(bounds[1] * h);
    var right = Math.round(bounds[2] * w), bottom = Math.round(bounds[3] * h);
    var raw = null, error = null;
    try { raw = ocr(images.clip(image, x, y, right - x, bottom - y)); }
    catch (e) { error = String(e); }
    var values = [];
    if (raw && typeof raw.length === "number") for (var i = 0; i < raw.length; i++) {
        var item = raw[i];
        values.push({ string: String(item), text: item && item.text, value: item && item.value });
    }
    return { rawType: typeof raw, length: raw && raw.length, values: values, error: error };
}
files.write(out, JSON.stringify({ credits: read(config.regions.playerCredits),
    wide: read([0.018, 0.66, 0.105, 0.80]),
    leftWide: read([0.018, 0.66, 0.082, 0.80]), image: [w, h] }));
