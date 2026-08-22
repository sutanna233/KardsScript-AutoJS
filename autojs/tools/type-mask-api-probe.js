/* Read-only API/crop probe for foil-independent unit icon silhouettes. */
var out = "/sdcard/AutoJs6/KardsScript/type-mask-api-probe.json";
auto.waitFor();
try { app.launchPackage("com.android1939.kardsapk"); sleep(1200); } catch (e) {}
if (!requestScreenCapture(true)) { files.write(out, JSON.stringify({ error: "capture" })); exit(); }
sleep(2500);
var result = { grayscale: typeof images.grayscale, threshold: typeof images.threshold, adaptiveThreshold: typeof images.adaptiveThreshold };
var frame = captureScreen(), clip = null, gray = null, binary = null;
try {
    // Current measured rear-left-1 icon search region.
    clip = images.clip(frame, 624, 546, 38, 40);
    gray = images.grayscale(clip);
    binary = images.threshold(gray, 135, 255, "BINARY");
    images.save(clip, "/sdcard/AutoJs6/KardsScript/type-mask-source.png");
    images.save(binary, "/sdcard/AutoJs6/KardsScript/type-mask-binary.png");
    result.matches = [];
    ["infantry-inner-mask.png", "infantry-rear-inner-mask.png", "tank-inner-mask.png", "tank-rear-inner-mask.png",
     "artillery-inner-mask.png", "fighter-inner-mask.png", "bomber-inner-mask.png"].forEach(function (name) {
        var templateRaw = images.read("/sdcard/AutoJs6/KardsScript/autojs/templates/types/masks-inner/" + name);
        var template = images.grayscale(templateRaw);
        var matched = images.matchTemplate(binary, template, { threshold: 0.01, max: 1,
            region: [0, 0, binary.getWidth(), binary.getHeight()] });
        var best = matched && typeof matched.best === "function" ? matched.best() : null;
        var findLevel = null;
        [0.95,0.90,0.85,0.80,0.75,0.70,0.65,0.60,0.55,0.50,0.45,0.40,0.35,0.30].some(function (level) {
            var point = images.findImage(binary, template, { threshold: level,
                region: [0, 0, binary.getWidth(), binary.getHeight()] });
            if (point) { findLevel = level; return true; }
            return false;
        });
        result.matches.push({ name: name, similarity: best ? best.similarity : null, findLevel: findLevel });
        try { template.recycle(); } catch (ignored) {}
        try { templateRaw.recycle(); } catch (ignored2) {}
    });
    result.ok = true;
} catch (error) { result.error = String(error); }
files.write(out, JSON.stringify(result, null, 2));
try { if (binary) binary.recycle(); } catch (e1) {}
try { if (gray) gray.recycle(); } catch (e2) {}
try { if (clip) clip.recycle(); } catch (e3) {}
