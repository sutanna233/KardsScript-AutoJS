// One-frame OCR probe for the fixed card-detail type label.
var out = "/sdcard/AutoJs6/KardsScript/card-detail-ocr-probe.json";
if (!requestScreenCapture(true)) { files.write(out, JSON.stringify({ error: "capture-permission" })); exit(); }
sleep(500);
try { app.launchPackage("com.android1939.kardsapk"); } catch (e) {}
sleep(700);
var frame = captureScreen(), words = null, values = [];
try {
    // The large type heading and its icon occupy the first row of the fixed
    // left-side detail panel. Keep the crop above the ability description.
    words = ocr(images.clip(frame, 65, 125, 250, 85));
    if (words && typeof words.length === "number") {
        for (var i = 0; i < words.length; i++) values.push(String(words[i]));
    }
    files.write(out, JSON.stringify({ words: values }));
} catch (error) {
    files.write(out, JSON.stringify({ error: String(error), words: values }));
}
try { if (frame.recycle) frame.recycle(); } catch (recycleError) {}
