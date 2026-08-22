if (!requestScreenCapture(true)) exit();
sleep(500);
var frame = captureScreen(), p = "/sdcard/AutoJs6/KardsScript/autojs/templates/buttons/guard-marker-enemy.png", t = images.read(p), out = {};
try {
    out.size = [t.getWidth(), t.getHeight()];
    [0.90, 0.82, 0.70].forEach(function (th) {
        var m = images.findImage(frame, t, { threshold: th });
        out[String(th)] = m ? { x: m.x, y: m.y } : null;
    });
} catch (e) { out.error = String(e); }
finally { t.recycle(); frame.recycle(); }
files.write("/sdcard/AutoJs6/KardsScript/guard-template-probe.json", JSON.stringify(out));
